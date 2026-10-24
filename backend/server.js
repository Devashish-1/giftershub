require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const { MongoClient, ObjectId } = require('mongodb');
const rateLimit = require('express-rate-limit');
const { cert, getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const scrypt = promisify(crypto.scrypt);
const app = express();
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '127.0.0.1';
const DATABASE_NAME = process.env.MONGODB_DB_NAME || 'gifters_hub';
const SESSION_COOKIE = 'gh_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FREE_SHIP = 999, GIFT_WRAP = 99;
const products = [
  ...JSON.parse(fs.readFileSync(path.join(__dirname, 'data/products.json'), 'utf8')),
  ...JSON.parse(fs.readFileSync(path.join(__dirname, 'data/crystal-bubble-products.json'), 'utf8')),
];
const coupons = {
  GIFTHUB10: { type: 'pct', value: 10 },
  UPI5: { type: 'pct', value: 5 },
  DIWALI100: { type: 'flat', value: 100, min: 799 },
};
const mongoClient = process.env.MONGODB_URI
  ? new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
  : null;
let database = null;
const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
const firebaseServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
  : null;
const firebaseAuth = firebaseProjectId
  ? getAuth(getApps().find(app => app.name === 'gifter-hub-auth') || initializeApp({
    ...(firebaseServiceAccount ? { credential: cert(firebaseServiceAccount) } : {}),
    projectId: firebaseProjectId,
  }, 'gifter-hub-auth'))
  : null;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/api/auth', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use('/api/admin', (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  res.once('finish', () => {
    if (!req.user || !database || res.statusCode < 200 || res.statusCode >= 400) return;
    const route = req.route?.path;
    database.collection('vyapaar_activity').insertOne({
      action: req.method,
      resource: typeof route === 'string' ? `${req.baseUrl}${route}` : '/api/admin',
      statusCode: res.statusCode,
      actorId: req.user._id.toString(),
      actorEmail: req.user.email,
      createdAt: new Date(),
    }).catch(error => console.error('Unable to record admin activity:', error.message));
  });
  next();
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please try again in 15 minutes.' },
});
const passwordResetRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many password reset requests. Please try again in 15 minutes.' },
});
const passwordResetVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many password reset attempts. Please try again in 15 minutes.' },
});
const registrationRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many verification code requests. Please try again in 15 minutes.' },
});
const registrationVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many email verification attempts. Please try again in 15 minutes.' },
});

function dbRequired(req, res, next) {
  if (!database) return res.status(503).json({ error: 'Account services are unavailable until MongoDB is configured.' });
  next();
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function publicUser(user) {
  return { id: user._id.toString(), name: user.name, email: user.email, role: user.role || 'customer' };
}

async function issueSession(user, res) {
  const token = crypto.randomBytes(32).toString('hex');
  await database.collection('sessions').insertOne({
    tokenHash: hashToken(token),
    userId: user._id,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS,
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  };
}

function readCookie(req, name) {
  const cookies = (req.headers.cookie || '').split(';');
  const entry = cookies.map(value => value.trim()).find(value => value.startsWith(`${name}=`));
  return entry ? entry.slice(name.length + 1) : '';
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function hashPasswordResetCode(email, code) {
  return crypto.createHmac('sha256', process.env.BREVO_API_KEY)
    .update(`${email}:${code}`)
    .digest('hex');
}

function hashRegistrationCode(email, code) {
  return crypto.createHmac('sha256', process.env.BREVO_API_KEY)
    .update(`register:${email}:${code}`)
    .digest('hex');
}

function isValidNewPassword(password) {
  return typeof password === 'string' && /^[A-Za-z0-9]{6,128}$/.test(password);
}

async function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = await scrypt(password, salt, 64);
  return { salt, hash: hash.toString('hex') };
}

async function passwordMatches(password, salt, expectedHash) {
  const actual = await scrypt(password, salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
}

async function sendOrderUpdateEmail(order, subject, heading) {
  if (!order.userId || !order.email) return;
  const user = await database.collection('users').findOne(
    { _id: order.userId },
    { projection: { 'preferences.orderEmail': 1 } },
  );
  if (!user?.preferences?.orderEmail) return;
  if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
    throw new Error('Brevo is not configured for order notifications.');
  }
  const safe = value => String(value || '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
  const status = order.status || 'pending';
  const paymentStatus = order.paymentStatus || 'pending';
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    signal: AbortSignal.timeout(10000),
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: process.env.BREVO_SENDER_NAME || 'The Gifters Hub',
        email: process.env.BREVO_SENDER_EMAIL,
      },
      to: [{ email: order.email }],
      subject,
      textContent: `${heading}\nOrder ${order.orderId}\nOrder status: ${status}\nPayment status: ${paymentStatus}`,
      htmlContent: `<p>${safe(heading)}</p><p>Order <strong>${safe(order.orderId)}</strong></p><p>Order status: ${safe(status)}<br>Payment status: ${safe(paymentStatus)}</p>`,
    }),
  });
  if (!response.ok) throw new Error(`Brevo returned status ${response.status}.`);
}

async function sendGiftReminderEmail(email, reminder, daysUntil) {
  if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
    throw new Error('Brevo is not configured for gift reminders.');
  }
  const safe = value => String(value || '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
  const occasion = reminder.occasion[0].toUpperCase() + reminder.occasion.slice(1);
  const timing = daysUntil === 0 ? 'today' : `in ${daysUntil} days`;
  const subject = `${occasion} reminder: ${reminder.name} is coming up`;
  const heading = `${reminder.name}'s ${occasion.toLowerCase()} is ${timing}. Find a thoughtful gift at The Gifter's Hub.`;
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    signal: AbortSignal.timeout(10000),
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: process.env.BREVO_SENDER_NAME || 'The Gifters Hub',
        email: process.env.BREVO_SENDER_EMAIL,
      },
      to: [{ email }],
      subject,
      textContent: `${heading}\n${reminder.name} · ${reminder.date}`,
      htmlContent: `<p>${safe(heading)}</p><p>${safe(reminder.name)} · ${safe(reminder.date)}</p><p><a href="https://giftershub.vercel.app/shop">Browse gift ideas</a></p>`,
    }),
  });
  if (!response.ok) throw new Error(`Brevo returned status ${response.status}.`);
}

async function runGiftReminderSweep() {
  if (!database || !process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) return;
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const reminders = await database.collection('gift_reminders').find({ emailEnabled: true }).toArray();
  for (const reminder of reminders) {
    const [, month, day] = reminder.date.split('-').map(Number);
    let eventYear = today.getUTCFullYear();
    let eventDate = new Date(Date.UTC(eventYear, month - 1, day));
    if (eventDate.getUTCMonth() !== month - 1 || eventDate.getUTCDate() !== day) {
      eventDate = new Date(Date.UTC(eventYear, month, 0));
    }
    if (eventDate.getTime() < todayUtc) {
      eventYear += 1;
      eventDate = new Date(Date.UTC(eventYear, month - 1, day));
      if (eventDate.getUTCMonth() !== month - 1 || eventDate.getUTCDate() !== day) {
        eventDate = new Date(Date.UTC(eventYear, month, 0));
      }
    }
    const daysUntil = Math.floor((eventDate.getTime() - todayUtc) / 86400000);
    if (daysUntil > 7) continue;

    const claim = await database.collection('gift_reminders').updateOne(
      { _id: reminder._id, emailEnabled: true, lastNotifiedFor: { $ne: eventYear } },
      { $set: { lastNotifiedFor: eventYear } },
    );
    if (!claim.modifiedCount) continue;
    try {
      const user = await database.collection('users').findOne(
        { _id: reminder.userId },
        { projection: { email: 1 } },
      );
      if (!user?.email) throw new Error('Reminder account email is unavailable.');
      await sendGiftReminderEmail(user.email, reminder, daysUntil);
    } catch (error) {
      await database.collection('gift_reminders').updateOne(
        { _id: reminder._id, lastNotifiedFor: eventYear },
        { $unset: { lastNotifiedFor: '' } },
      );
      console.error(`Gift reminder delivery failed for ${reminder._id}:`, error.message);
    }
  }
}

async function findCurrentUser(req) {
  if (!database) return null;
  const token = readCookie(req, SESSION_COOKIE);
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await database.collection('sessions').findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  });
  if (!session) return null;
  return database.collection('users').findOne({ _id: session.userId });
}

async function getProducts() {
  if (!database) return products;
  return database.collection('products').find({ archived: { $ne: true } }, { projection: { _id: 0 } }).toArray();
}

async function seedAdminUser() {
  const configuredEmail = normalizeEmail(process.env.ADMIN_EMAIL);
  const password = process.env.ADMIN_PASSWORD;
  if (!configuredEmail && !password) return;
  if (!configuredEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredEmail)) {
    throw new Error('ADMIN_EMAIL must be a valid email address when bootstrapping an admin.');
  }

  const users = database.collection('users');
  const existing = await users.findOne({ email: configuredEmail });
  if (existing) {
    if (existing.role !== 'admin') {
      await users.updateOne({ _id: existing._id }, { $set: { role: 'admin' } });
    }
    return;
  }
  if (typeof password !== 'string' || password.length < 16 || password.length > 128) {
    throw new Error('ADMIN_PASSWORD must be 16 to 128 characters when creating the initial admin.');
  }

  const credentials = await hashPassword(password);
  await users.insertOne({
    name: (process.env.ADMIN_NAME || 'Administrator').slice(0, 100),
    email: configuredEmail,
    role: 'admin',
    passwordSalt: credentials.salt,
    passwordHash: credentials.hash,
    createdAt: new Date(),
  });
}

function price(items, code, gift, catalog) {
  const lines = items.map(item => {
    const product = catalog.find(value =>
      value.slug === item.slug && value.available !== false &&
      Number.isFinite(value.price) && value.price > 0);
    return product && {
      slug: product.slug,
      name: product.name,
      variant: typeof item.variant === 'string' ? item.variant.trim().slice(0, 120) : '',
      qty: item.qty,
      unit: product.price,
      total: product.price * item.qty,
    };
  }).filter(Boolean);
  const sub = lines.reduce((sum, line) => sum + line.total, 0);
  const coupon = coupons[(code || '').toUpperCase()];
  const off = coupon && (!coupon.min || sub >= coupon.min)
    ? (coupon.type === 'pct' ? Math.round(sub * coupon.value / 100) : coupon.value)
    : 0;
  const ship = sub - off >= FREE_SHIP || !sub ? 0 : 79;
  const giftFee = gift ? GIFT_WRAP : 0;
  return {
    lines,
    sub,
    off,
    ship,
    giftFee,
    total: sub - off + ship + giftFee,
    toFree: Math.max(0, FREE_SHIP - (sub - off)),
    couponOk: !!off,
  };
}

function validItems(items) {
  return Array.isArray(items) && items.length > 0 && items.length <= 30 &&
    items.every(item => item && typeof item.slug === 'string' &&
      Number.isInteger(item.qty) && item.qty > 0 && item.qty <= 99 &&
      (item.variant === undefined || (typeof item.variant === 'string' && item.variant.length <= 120)));
}

function validCartItems(items) {
  return Array.isArray(items) && items.length <= 30 &&
    items.every(item => item && typeof item.slug === 'string' && item.slug.length <= 200 &&
      Number.isInteger(item.qty) && item.qty > 0 && item.qty <= 99 &&
      (item.variant === undefined || (typeof item.variant === 'string' && item.variant.length <= 120)));
}

function mergeCartItems(currentItems, incomingItems) {
  const merged = new Map();
  for (const item of [...currentItems, ...incomingItems]) {
    const variant = item.variant || '';
    const key = `${item.slug}\u0000${variant}`;
    const current = merged.get(key);
    const qty = (current?.qty || 0) + item.qty;
    if (qty > 99) throw new Error('The combined quantity of a product cannot exceed 99.');
    merged.set(key, { slug: item.slug, variant, qty });
  }
  if (merged.size > 30) throw new Error('Your account cart cannot contain more than 30 different items.');
  return [...merged.values()];
}

function cartItemsForClient(items, catalog) {
  return items.map(item => {
    const product = catalog.find(value => value.slug === item.slug);
    const variant = item.variant || '';
    return {
      key: `${item.slug}${variant}`,
      slug: item.slug,
      name: product?.name || item.slug,
      price: product?.price || 0,
      variant,
      qty: item.qty,
    };
  });
}

app.get('/health', (req, res) => res.json({ ok: true, database: database ? 'connected' : 'not_configured' }));

app.get('/api/products', async (req, res, next) => {
  try {
    const { category, subject, q, sort, min, max } = req.query;
    const minimum = min === undefined ? null : Number(min);
    const maximum = max === undefined ? null : Number(max);
    if ((minimum !== null && (!Number.isFinite(minimum) || minimum < 0)) ||
        (maximum !== null && (!Number.isFinite(maximum) || maximum < 0))) {
      return res.status(400).json({ error: 'Invalid price filter.' });
    }
    let list = (await getProducts()).filter(product =>
      (!category || product.category === category) &&
      (!subject || product.subject === subject) &&
      (!q || (product.name + product.desc).toLowerCase().includes(String(q).toLowerCase())) &&
      (minimum === null || (Number.isFinite(product.price) && product.price >= minimum)) &&
      (maximum === null || (Number.isFinite(product.price) && product.price <= maximum)));
    const sorters = {
      low: (a, b) => a.price == null ? (b.price == null ? 0 : 1) : b.price == null ? -1 : a.price - b.price,
      high: (a, b) => a.price == null ? (b.price == null ? 0 : 1) : b.price == null ? -1 : b.price - a.price,
      rating: (a, b) => b.rating - a.rating,
    };
    if (sorters[sort]) list = [...list].sort(sorters[sort]);
    res.json(list);
  } catch (error) {
    next(error);
  }
});

app.get('/api/products/:slug', async (req, res, next) => {
  try {
    const catalog = await getProducts();
    const product = catalog.find(value => value.slug === req.params.slug);
    if (!product) return res.status(404).json({ error: 'Not found' });
    const related = catalog.filter(value => value.category === product.category && value.slug !== product.slug).slice(0, 4);
    res.json({ ...product, related });
  } catch (error) {
    next(error);
  }
});

const PRODUCT_CATEGORIES = ['god-frames', 'family-frames', 'crystal-bubble'];
const PRODUCT_STATUSES = ['active', 'coming-soon', 'out-of-stock'];
const PRODUCT_TAX_RATES = [0, 5, 12, 18, 28];
const PRODUCT_IMAGE_PATH = /^\/products\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:webp|png|jpe?g)$/i;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function findProductIdentifierConflict(collection, product, currentSlug) {
  for (const field of ['sku', 'barcode']) {
    if (!product[field]) continue;
    const existing = await collection.findOne({
      [field]: product[field],
      ...(currentSlug ? { slug: { $ne: currentSlug } } : {}),
    }, { projection: { _id: 0, name: 1 } });
    if (existing) return `${field === 'sku' ? 'SKU' : 'Barcode'} is already used by another product.`;
  }
  return '';
}

function parseAdminProduct(input, existing) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { error: 'Provide product details.' };
  }

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const slug = existing?.slug || (typeof input.slug === 'string' ? input.slug.trim().toLowerCase() : '');
  const category = input.category;
  const subject = typeof input.subject === 'string' ? input.subject.trim() : '';
  const sku = typeof input.sku === 'string' ? input.sku.trim().toUpperCase() : '';
  const barcode = typeof input.barcode === 'string' ? input.barcode.trim().toUpperCase() : '';
  const unit = typeof input.unit === 'string' ? input.unit.trim().toLowerCase() : 'piece';
  const image = typeof input.image === 'string' ? input.image.trim() : '';
  const desc = typeof input.desc === 'string' ? input.desc.trim() : '';
  const status = input.status;
  const parseAmount = value => value === '' || value === null || value === undefined ? null : Number(value);
  const purchasePrice = parseAmount(input.purchasePrice);
  const price = parseAmount(input.price);
  const mrp = parseAmount(input.mrp);
  const taxRate = input.taxRate === '' || input.taxRate === null || input.taxRate === undefined
    ? (existing?.taxRate ?? 0)
    : Number(input.taxRate);
  const lowStockThreshold = input.lowStockThreshold === '' || input.lowStockThreshold === null || input.lowStockThreshold === undefined
    ? (existing?.lowStockThreshold ?? 0)
    : Number(input.lowStockThreshold);
  const stock = existing ? (Number.isSafeInteger(existing.stock) ? existing.stock : 0) : 0;
  const gallery = Array.isArray(input.gallery) && input.gallery.length ? input.gallery : [image];

  if (name.length < 2 || name.length > 120) return { error: 'Product name must be between 2 and 120 characters.' };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) return { error: 'Use a valid product URL slug.' };
  if (typeof category !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category) || category.length > 80) {
    return { error: 'Choose a valid product category.' };
  }
  if (subject.length > 80) return { error: 'Artwork name must be 80 characters or fewer.' };
  if (sku.length > 80 || (sku && !/^[A-Z0-9][A-Z0-9._/-]*$/.test(sku))) return { error: 'Use a valid SKU with letters, numbers, dots, hyphens, underscores, or slashes.' };
  if (barcode.length > 80 || (barcode && !/^[A-Za-z0-9_-]{4,80}$/.test(barcode))) return { error: 'Barcode must be 4 to 80 letters, numbers, hyphens, or underscores.' };
  if (!/^[a-z0-9][a-z0-9 -]{0,23}$/.test(unit)) return { error: 'Use a valid unit name of up to 24 characters.' };
  if (!PRODUCT_IMAGE_PATH.test(image) || image.includes('..')) return { error: 'Use an image from the local /products folder.' };
  if (desc.length > 3000) return { error: 'Description must be 3,000 characters or fewer.' };
  if (!PRODUCT_STATUSES.includes(status)) return { error: 'Choose a valid product status.' };
  if (purchasePrice !== null && (!Number.isFinite(purchasePrice) || purchasePrice < 0)) return { error: 'Enter a valid purchase price.' };
  if (price !== null && (!Number.isFinite(price) || price < 0)) return { error: 'Enter a valid selling price.' };
  if (mrp !== null && (!Number.isFinite(mrp) || mrp < 0)) return { error: 'Enter a valid MRP.' };
  if (!PRODUCT_TAX_RATES.includes(taxRate)) return { error: 'Choose a supported tax rate.' };
  if (price !== null && mrp !== null && mrp < price) return { error: 'MRP must be equal to or higher than the selling price.' };
  if (status === 'active' && (!Number.isFinite(price) || price <= 0)) {
    return { error: 'Add a selling price before making this product active.' };
  }
  if (!Number.isSafeInteger(lowStockThreshold) || lowStockThreshold < 0) return { error: 'Low-stock threshold must be a non-negative whole number.' };
  if (!gallery.length || gallery.length > 10 || gallery.some(path => typeof path !== 'string' || !PRODUCT_IMAGE_PATH.test(path) || path.includes('..'))) {
    return { error: 'Add up to 10 valid image paths from the local /products folder.' };
  }

  const product = {
    ...(existing || {}),
    slug,
    name,
    category,
    subject,
    ...(sku ? { sku } : {}),
    ...(barcode ? { barcode } : {}),
    unit,
    price,
    purchasePrice,
    mrp,
    taxRate,
    available: status === 'active',
    status,
    badge: status === 'active' ? '' : status === 'out-of-stock' ? 'Out of stock' : 'Price coming soon',
    stock,
    lowStockThreshold,
    desc,
    image,
    gallery: [...new Set([image, ...gallery])],
    details: {
      ...(existing?.details || {}),
      Model: name,
      ...(subject ? { Artwork: subject } : {}),
    },
    options: existing?.options || {},
    rating: existing?.rating || 0,
    reviews: existing?.reviews || 0,
    archived: false,
  };
  if (!sku) delete product.sku;
  if (!barcode) delete product.barcode;
  return { product };
}

app.post('/api/auth/register/request', registrationRequestLimiter, dbRequired, async (req, res, next) => {
  try {
    const suppliedName = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const name = suppliedName || 'Customer';
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;
    if (suppliedName && (suppliedName.length < 2 || suppliedName.length > 100)) {
      return res.status(400).json({ error: 'Name must be between 2 and 100 characters.' });
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (!isValidNewPassword(password)) {
      return res.status(400).json({ error: 'Use 6 to 128 letters and numbers only for your password.' });
    }
    const credentials = await hashPassword(password);
    if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
      return res.status(503).json({ error: 'Email verification is not configured yet. Please contact support.' });
    }

    const users = database.collection('users');
    if (await users.findOne({ email }, { projection: { _id: 1 } })) {
      return res.status(409).json({ error: 'An account with this email already exists. Sign in instead.' });
    }

    const registrations = database.collection('pending_registrations');
    const now = new Date();
    const existing = await registrations.findOne({ _id: email });
    if (existing && existing.createdAt > new Date(now.getTime() - 60 * 1000)) {
      return res.status(429).json({ error: 'A verification code was just sent. Please wait a minute before requesting another.' });
    }

    const code = crypto.randomInt(100000, 1000000).toString();
    const otpHash = hashRegistrationCode(email, code);
    await registrations.replaceOne({ _id: email }, {
      _id: email,
      name,
      passwordSalt: credentials.salt,
      passwordHash: credentials.hash,
      otpHash,
      attempts: 0,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
    }, { upsert: true });

    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          sender: {
            name: process.env.BREVO_SENDER_NAME || 'The Gifters Hub',
            email: process.env.BREVO_SENDER_EMAIL,
          },
          to: [{ email }],
          subject: 'Verify your email for The Gifters Hub',
          textContent: `Your email verification code is ${code}. It expires in 10 minutes. If you did not try to create an account, you can ignore this email.`,
          htmlContent: `<p>Your email verification code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p>This code expires in 10 minutes. If you did not try to create an account, you can ignore this email.</p>`,
        }),
      });
      if (!response.ok) throw new Error(`Brevo returned status ${response.status}.`);
    } catch (deliveryError) {
      await registrations.deleteOne({ _id: email, otpHash });
      console.error('Registration verification email delivery failed:', deliveryError.message);
      return res.status(502).json({ error: 'Could not send the verification code. Please try again later.' });
    }

    res.json({ message: 'A verification code has been sent to your email address.' });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/register/verify', registrationVerifyLimiter, dbRequired, async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const code = req.body.code;
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Enter your email address and 6-digit verification code.' });
    }

    const registrations = database.collection('pending_registrations');
    const pending = await registrations.findOne({ _id: email, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } });
    if (!pending) return res.status(400).json({ error: 'That verification code is invalid or expired. Request a new code.' });

    const submittedHash = hashRegistrationCode(email, code);
    const expected = Buffer.from(pending.otpHash, 'hex');
    const submitted = Buffer.from(submittedHash, 'hex');
    if (expected.length !== submitted.length || !crypto.timingSafeEqual(expected, submitted)) {
      await registrations.updateOne(
        { _id: email, otpHash: pending.otpHash, attempts: { $lt: 5 } },
        { $inc: { attempts: 1 } },
      );
      return res.status(400).json({ error: 'That verification code is invalid or expired. Request a new code.' });
    }

    const user = {
      name: pending.name,
      email,
      role: 'customer',
      passwordSalt: pending.passwordSalt,
      passwordHash: pending.passwordHash,
      emailVerified: true,
      createdAt: new Date(),
    };
    try {
      const result = await database.collection('users').insertOne(user);
      user._id = result.insertedId;
    } catch (error) {
      if (error.code === 11000) {
        await registrations.deleteOne({ _id: email, otpHash: pending.otpHash });
        return res.status(409).json({ error: 'An account with this email already exists. Sign in instead.' });
      }
      throw error;
    }

    await registrations.deleteOne({ _id: email, otpHash: pending.otpHash });
    await issueSession(user, res);
    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login', authLimiter, dbRequired, async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;
    if (!email || typeof password !== 'string' || password.length > 128) {
      return res.status(400).json({ error: 'Enter your email and password.' });
    }
    const user = await database.collection('users').findOne({ email });
    const matches = user && await passwordMatches(password, user.passwordSalt, user.passwordHash);
    if (!matches) return res.status(401).json({ error: 'Email or password is incorrect.' });

    await issueSession(user, res);
    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/password-reset/request', passwordResetRequestLimiter, dbRequired, async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }
    if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
      return res.status(503).json({ error: 'Password reset email is not configured yet. Please contact support.' });
    }

    const users = database.collection('users');
    const user = await users.findOne({ email }, { projection: { _id: 1 } });
    if (!user) {
      return res.json({ message: 'If an account exists for this email, a reset code has been sent.' });
    }

    const resetCodes = database.collection('password_reset_codes');
    const now = new Date();
    const existing = await resetCodes.findOne({ _id: email });
    if (existing && existing.createdAt > new Date(now.getTime() - 60 * 1000)) {
      return res.json({ message: 'If an account exists for this email, a reset code has been sent.' });
    }

    const code = crypto.randomInt(100000, 1000000).toString();
    const otpHash = hashPasswordResetCode(email, code);
    await resetCodes.replaceOne({ _id: email }, {
      _id: email,
      otpHash,
      attempts: 0,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
    }, { upsert: true });

    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          sender: {
            name: process.env.BREVO_SENDER_NAME || 'The Gifters Hub',
            email: process.env.BREVO_SENDER_EMAIL,
          },
          to: [{ email }],
          subject: 'Your password reset code',
          textContent: `Your password reset code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
          htmlContent: `<p>Your password reset code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>`,
        }),
      });
      if (!response.ok) {
        throw new Error(`Brevo returned status ${response.status}.`);
      }
    } catch (deliveryError) {
      await resetCodes.deleteOne({ _id: email, otpHash });
      console.error('Password reset email delivery failed:', deliveryError.message);
      return res.status(502).json({ error: 'Could not send the reset code. Please try again later.' });
    }

    res.json({ message: 'If an account exists for this email, a reset code has been sent.' });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/password-reset/confirm', passwordResetVerifyLimiter, dbRequired, async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const code = req.body.code;
    const password = req.body.password;
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Enter the email address and 6-digit reset code.' });
    }
    if (!isValidNewPassword(password)) {
      return res.status(400).json({ error: 'Use 6 to 128 letters and numbers only for your new password.' });
    }

    if (!process.env.BREVO_API_KEY) {
      return res.status(503).json({ error: 'Password reset email is not configured yet. Please contact support.' });
    }
    const resetCodes = database.collection('password_reset_codes');
    const challenge = await resetCodes.findOne({ _id: email, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } });
    if (!challenge) {
      return res.status(400).json({ error: 'That reset code is invalid or expired. Request a new code.' });
    }
    const user = await database.collection('users').findOne({ email }, { projection: { _id: 1 } });
    if (!user) {
      return res.status(400).json({ error: 'That reset code is invalid or expired. Request a new code.' });
    }

    const submittedHash = hashPasswordResetCode(email, code);
    const expected = Buffer.from(challenge.otpHash, 'hex');
    const submitted = Buffer.from(submittedHash, 'hex');
    if (expected.length !== submitted.length || !crypto.timingSafeEqual(expected, submitted)) {
      await resetCodes.updateOne(
        { _id: email, otpHash: challenge.otpHash, attempts: { $lt: 5 } },
        { $inc: { attempts: 1 } },
      );
      return res.status(400).json({ error: 'That reset code is invalid or expired. Request a new code.' });
    }

    const credentials = await hashPassword(password);
    const consumed = await resetCodes.deleteOne({
      _id: email,
      otpHash: challenge.otpHash,
      expiresAt: { $gt: new Date() },
      attempts: { $lt: 5 },
    });
    if (!consumed.deletedCount) {
      return res.status(400).json({ error: 'That reset code is invalid or expired. Request a new code.' });
    }

    const result = await database.collection('users').updateOne(
      { _id: user._id },
      { $set: { passwordSalt: credentials.salt, passwordHash: credentials.hash } },
    );
    if (!result.matchedCount) {
      return res.status(400).json({ error: 'That reset code is invalid or expired. Request a new code.' });
    }
    await database.collection('sessions').deleteMany({ userId: user._id });
    res.json({ message: 'Password updated. Please sign in with your new password.' });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/google', authLimiter, dbRequired, async (req, res, next) => {
  try {
    if (!firebaseAuth) {
      return res.status(503).json({ error: 'Google sign-in is not configured on the account service yet.' });
    }
    if (typeof req.body.idToken !== 'string' || req.body.idToken.length > 12000) {
      return res.status(400).json({ error: 'A valid Google sign-in token is required.' });
    }

    let identity;
    try {
      identity = await firebaseAuth.verifyIdToken(req.body.idToken, Boolean(firebaseServiceAccount));
    } catch (error) {
      if (['auth/argument-error', 'auth/id-token-expired', 'auth/id-token-revoked', 'auth/invalid-id-token'].includes(error.code)) {
        return res.status(401).json({ error: 'Google sign-in could not be verified. Please try again.' });
      }
      throw error;
    }
    if (identity.firebase?.sign_in_provider !== 'google.com' || identity.email_verified !== true) {
      return res.status(401).json({ error: 'Use a verified Google account to sign in.' });
    }

    const email = normalizeEmail(identity.email);
    if (!email || email.length > 254) {
      return res.status(401).json({ error: 'Google did not provide a verified email address.' });
    }

    const users = database.collection('users');
    let user = await users.findOne({ firebaseUid: identity.uid });
    if (user && user.email !== email) {
      return res.status(409).json({ error: 'Your Google account email changed. Contact support to update your account.' });
    }
    if (!user) {
      user = await users.findOne({ email });
      if (user?.firebaseUid && user.firebaseUid !== identity.uid) {
        return res.status(409).json({ error: 'This email is already connected to another Google account.' });
      }
      if (user) {
        await users.updateOne({ _id: user._id }, {
          $set: {
            firebaseUid: identity.uid,
            name: user.name || identity.name || email,
          },
        });
        user.firebaseUid = identity.uid;
        user.name = user.name || identity.name || email;
      } else {
        const result = await users.insertOne({
          name: identity.name || email,
          email,
          firebaseUid: identity.uid,
          role: 'customer',
          createdAt: new Date(),
        });
        user = { _id: result.insertedId, name: identity.name || email, email, role: 'customer' };
      }
    }

    await issueSession(user, res);
    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/me', async (req, res, next) => {
  try {
    if (!database) return res.status(503).json({ error: 'Account services are unavailable until MongoDB is configured.' });
    const user = await findCurrentUser(req);
    res.json({ user: user ? publicUser(user) : null });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/logout', dbRequired, async (req, res, next) => {
  try {
    const token = readCookie(req, SESSION_COOKIE);
    if (/^[a-f0-9]{64}$/.test(token)) {
      await database.collection('sessions').deleteOne({ tokenHash: hashToken(token) });
    }
    const options = sessionCookieOptions();
    delete options.maxAge;
    res.clearCookie(SESSION_COOKIE, options);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

async function requireUser(req, res, next) {
  try {
    if (!database) return res.status(503).json({ error: 'Account services are unavailable until MongoDB is configured.' });
    const user = await findCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in to continue.' });
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

async function requireAdmin(req, res, next) {
  try {
    if (!database) return res.status(503).json({ error: 'Account services are unavailable until MongoDB is configured.' });
    const user = await findCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in to continue.' });
    if (user.role !== 'admin') return res.status(403).json({ error: 'Administrator access is required.' });
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

function validateAddress(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const label = typeof input.label === 'string' ? input.label.trim() : '';
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const phone = typeof input.phone === 'string' ? input.phone.trim() : '';
  const pincode = typeof input.pincode === 'string' ? input.pincode.trim() : '';
  const address = typeof input.address === 'string' ? input.address.trim() : '';
  const locality = typeof input.locality === 'string' ? input.locality.trim() : '';
  const city = typeof input.city === 'string' ? input.city.trim() : '';
  const state = typeof input.state === 'string' ? input.state.trim() : '';
  const country = typeof input.country === 'string' ? input.country.trim() : '';
  if (!['Home', 'Work', 'Other'].includes(label) ||
      name.length < 2 || name.length > 100 ||
      !/^\d{10}$/.test(phone) ||
      !/^[1-9]\d{5}$/.test(pincode) ||
      address.length < 8 || address.length > 500 ||
      locality.length > 100 || city.length > 100 || state.length > 100 || country.length > 100) {
    return null;
  }
  return { label, name, phone, pincode, address, locality, city, state, country };
}

app.get('/api/account/profile', requireUser, async (req, res, next) => {
  try {
    res.json({
      profile: {
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone || '',
        hasPassword: Boolean(req.user.passwordHash),
        isAdmin: req.user.role === 'admin',
      },
    });
  } catch (error) {
    next(error);
  }
});

app.put('/api/account/profile', requireUser, async (req, res, next) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
    if (name.length < 2 || name.length > 100) {
      return res.status(400).json({ error: 'Name must be between 2 and 100 characters.' });
    }
    if (phone && !/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: 'Enter a valid 10-digit mobile number.' });
    }
    await database.collection('users').updateOne(
      { _id: req.user._id },
      { $set: { name, phone, updatedAt: new Date() } },
    );
    res.json({ profile: { name, email: req.user.email, phone, hasPassword: Boolean(req.user.passwordHash), isAdmin: req.user.role === 'admin' } });
  } catch (error) {
    next(error);
  }
});

app.get('/api/account/addresses', requireUser, async (req, res, next) => {
  try {
    const user = await database.collection('users').findOne(
      { _id: req.user._id },
      { projection: { addresses: 1, defaultAddressId: 1 } },
    );
    const addresses = user?.addresses || [];
    const defaultAddressId = addresses.some(address => address.id === user.defaultAddressId)
      ? user.defaultAddressId
      : addresses[0]?.id || '';
    res.json({ addresses, defaultAddressId });
  } catch (error) {
    next(error);
  }
});

app.post('/api/account/addresses', requireUser, async (req, res, next) => {
  try {
    const address = validateAddress(req.body);
    if (!address) return res.status(400).json({ error: 'Enter a valid address, contact name, mobile number, and pincode.' });
    address.id = crypto.randomUUID();
    const result = await database.collection('users').updateOne(
      {
        _id: req.user._id,
        $expr: { $lt: [{ $size: { $ifNull: ['$addresses', []] } }, 10] },
      },
      { $push: { addresses: address }, $set: { updatedAt: new Date() } },
    );
    if (!result.matchedCount) return res.status(409).json({ error: 'You can save up to 10 addresses.' });
    await database.collection('users').updateOne(
      {
        _id: req.user._id,
        $or: [
          { defaultAddressId: { $exists: false } },
          { defaultAddressId: null },
          { defaultAddressId: '' },
        ],
      },
      { $set: { defaultAddressId: address.id } },
    );
    const user = await database.collection('users').findOne(
      { _id: req.user._id },
      { projection: { defaultAddressId: 1 } },
    );
    res.status(201).json({ address, defaultAddressId: user?.defaultAddressId || address.id });
  } catch (error) {
    next(error);
  }
});

app.put('/api/account/addresses/:addressId/default', requireUser, async (req, res, next) => {
  try {
    const result = await database.collection('users').updateOne(
      { _id: req.user._id, 'addresses.id': req.params.addressId },
      { $set: { defaultAddressId: req.params.addressId, updatedAt: new Date() } },
    );
    if (!result.matchedCount) return res.status(404).json({ error: 'That saved address could not be found.' });
    res.json({ defaultAddressId: req.params.addressId });
  } catch (error) {
    next(error);
  }
});

app.put('/api/account/addresses/:addressId', requireUser, async (req, res, next) => {
  try {
    const address = validateAddress(req.body);
    if (!address) return res.status(400).json({ error: 'Enter a valid address, contact name, mobile number, and pincode.' });
    const result = await database.collection('users').updateOne(
      { _id: req.user._id, 'addresses.id': req.params.addressId },
      { $set: {
        'addresses.$.label': address.label,
        'addresses.$.name': address.name,
        'addresses.$.phone': address.phone,
        'addresses.$.pincode': address.pincode,
        'addresses.$.address': address.address,
        'addresses.$.locality': address.locality,
        'addresses.$.city': address.city,
        'addresses.$.state': address.state,
        'addresses.$.country': address.country,
        updatedAt: new Date(),
      } },
    );
    if (!result.matchedCount) return res.status(404).json({ error: 'That saved address could not be found.' });
    res.json({ address: { ...address, id: req.params.addressId } });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/account/addresses/:addressId', requireUser, async (req, res, next) => {
  try {
    const users = database.collection('users');
    const result = await users.updateOne(
      { _id: req.user._id, 'addresses.id': req.params.addressId },
      { $pull: { addresses: { id: req.params.addressId } }, $set: { updatedAt: new Date() } },
    );
    if (!result.matchedCount) return res.status(404).json({ error: 'That saved address could not be found.' });
    const user = await users.findOne({ _id: req.user._id }, { projection: { addresses: 1, defaultAddressId: 1 } });
    if (user.defaultAddressId === req.params.addressId) {
      const defaultAddressId = user.addresses?.[0]?.id || '';
      await users.updateOne(
        { _id: req.user._id, defaultAddressId: req.params.addressId },
        { $set: { defaultAddressId, updatedAt: new Date() } },
      );
      return res.json({ defaultAddressId });
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get('/api/account/orders', requireUser, async (req, res, next) => {
  try {
    const orders = await database.collection('orders')
      .find(
        { userId: req.user._id },
        { projection: { _id: 0, orderId: 1, status: 1, paymentMethod: 1, paymentStatus: 1, lines: 1, total: 1, createdAt: 1 } },
      )
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    res.json({ orders });
  } catch (error) {
    next(error);
  }
});

app.get('/api/account/coupons', requireUser, async (req, res, next) => {
  try {
    const offers = Object.entries(coupons).map(([code, offer]) => ({
      code,
      description: offer.type === 'pct' ? `${offer.value}% off` : `₹${offer.value} off`,
      minimumSpend: offer.min || 0,
    }));
    const redemptions = await database.collection('orders')
      .find(
        { userId: req.user._id, couponCode: { $exists: true, $ne: '' } },
        { projection: { _id: 0, orderId: 1, couponCode: 1, off: 1, total: 1, status: 1, createdAt: 1 } },
      )
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    res.json({ offers, redemptions });
  } catch (error) {
    next(error);
  }
});

app.get('/api/account/shopping', requireUser, async (req, res, next) => {
  try {
    const catalog = await getProducts();
    const wishlist = Array.isArray(req.user.wishlist) ? req.user.wishlist : [];
    const wishlistProducts = wishlist
      .map(slug => catalog.find(product => product.slug === slug))
      .filter(Boolean);
    res.set('Cache-Control', 'no-store');
    res.json({
      items: cartItemsForClient(Array.isArray(req.user.cartItems) ? req.user.cartItems : [], catalog),
      wishlist: wishlist,
      wishlistProducts,
      unavailableWishlist: wishlist.filter(slug => !catalog.some(product => product.slug === slug)),
    });
  } catch (error) {
    next(error);
  }
});

app.put('/api/account/shopping', requireUser, async (req, res, next) => {
  try {
    const { items, wishlist } = req.body;
    if (!validCartItems(items) || !Array.isArray(wishlist) || wishlist.length > 1000 ||
        wishlist.some(slug => typeof slug !== 'string' || slug.length > 200)) {
      return res.status(400).json({ error: 'Your saved cart or wishlist is invalid.' });
    }
    const catalog = await getProducts();
    const validSlugs = new Set(catalog.map(product => product.slug));
    const cartItems = items.filter(item => catalog.some(product =>
      product.slug === item.slug && product.available !== false &&
      Number.isFinite(product.price) && product.price > 0))
      .map(({ slug, qty, variant }) => ({ slug, qty, variant: variant || '' }));
    const unavailable = items.filter(item => !cartItems.includes(item)).map(item => item.slug);
    const savedWishlist = [...new Set(wishlist.filter(slug => validSlugs.has(slug)))];
    const unavailableWishlist = [...new Set(wishlist.filter(slug => !validSlugs.has(slug)))];
    await database.collection('users').updateOne(
      { _id: req.user._id },
      { $set: { cartItems, wishlist: savedWishlist, updatedAt: new Date() } },
    );
    res.json({
      items: cartItemsForClient(cartItems, catalog),
      wishlist: savedWishlist,
      unavailable,
      unavailableWishlist,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/account/shopping/merge', requireUser, async (req, res, next) => {
  try {
    const guestItems = req.body.items === undefined ? [] : req.body.items;
    const guestWishlist = req.body.wishlist === undefined ? [] : req.body.wishlist;
    const mergeId = req.body.mergeId;
    if (typeof mergeId !== 'string' || !/^[a-f0-9-]{16,64}$/i.test(mergeId) ||
        !validCartItems(guestItems) || !Array.isArray(guestWishlist) || guestWishlist.length > 1000 ||
        guestWishlist.some(slug => typeof slug !== 'string' || slug.length > 200)) {
      return res.status(400).json({ error: 'Your guest cart or wishlist could not be merged.' });
    }
    const catalog = await getProducts();
    if (req.user.cartMergeId === mergeId) {
      return res.json({
        items: cartItemsForClient(Array.isArray(req.user.cartItems) ? req.user.cartItems : [], catalog),
        wishlist: Array.isArray(req.user.wishlist) ? req.user.wishlist : [],
        unavailable: [],
        unavailableWishlist: [],
      });
    }
    const purchasableSlugs = new Set(catalog
      .filter(product => product.available !== false && Number.isFinite(product.price) && product.price > 0)
      .map(product => product.slug));
    const validSlugs = new Set(catalog.map(product => product.slug));
    const availableGuestItems = guestItems.filter(item => purchasableSlugs.has(item.slug));
    const unavailable = guestItems.filter(item => !purchasableSlugs.has(item.slug)).map(item => item.slug);
    const existingItems = Array.isArray(req.user.cartItems) ? req.user.cartItems.filter(item =>
      purchasableSlugs.has(item.slug) && Number.isInteger(item.qty) && item.qty > 0 && item.qty <= 99)
      .map(({ slug, qty, variant }) => ({ slug, qty, variant: variant || '' })) : [];
    let items;
    try {
      items = mergeCartItems(existingItems, availableGuestItems);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    const currentWishlist = Array.isArray(req.user.wishlist) ? req.user.wishlist : [];
    const combinedWishlist = [...new Set([...currentWishlist, ...guestWishlist].filter(slug => validSlugs.has(slug)))];
    if (combinedWishlist.length > 1000) {
      return res.status(400).json({ error: 'Your merged wishlist exceeds the supported size. Remove a few saved products and try again.' });
    }
    const wishlist = combinedWishlist;
    const unavailableWishlist = [...new Set([...currentWishlist, ...guestWishlist].filter(slug => !validSlugs.has(slug)))];
    await database.collection('users').updateOne(
      { _id: req.user._id },
      { $set: { cartItems: items, wishlist, cartMergeId: mergeId, updatedAt: new Date() } },
    );
    res.json({
      items: cartItemsForClient(items, catalog),
      wishlist,
      unavailable,
      unavailableWishlist,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/account/reminders', requireUser, async (req, res, next) => {
  try {
    const reminders = await database.collection('gift_reminders').find(
      { userId: req.user._id },
      { projection: { userId: 0, lastNotifiedFor: 0 } },
    ).sort({ date: 1 }).toArray();
    res.set('Cache-Control', 'no-store');
    res.json({
      reminders: reminders.map(({ _id, ...reminder }) => ({ id: _id, ...reminder })),
      emailConfigured: Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/account/reminders', requireUser, async (req, res, next) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const occasion = req.body.occasion;
    const date = typeof req.body.date === 'string' ? req.body.date : '';
    const dateValue = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00.000Z`) : null;
    const emailEnabled = req.body.emailEnabled === true;
    if (name.length < 2 || name.length > 80 ||
        !['birthday', 'anniversary'].includes(occasion) ||
        !dateValue || Number.isNaN(dateValue.getTime()) || dateValue.toISOString().slice(0, 10) !== date ||
        !emailEnabled) {
      return res.status(400).json({ error: 'Enter a name, occasion, valid date, and opt in to email reminders.' });
    }
    if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
      return res.status(503).json({ error: 'Email reminders are not configured yet. Please try again later.' });
    }
    const reminderCount = await database.collection('gift_reminders').countDocuments({ userId: req.user._id });
    if (reminderCount >= 100) {
      return res.status(400).json({ error: 'You can save up to 100 gift reminders.' });
    }
    const reminder = {
      _id: crypto.randomBytes(12).toString('hex'),
      userId: req.user._id,
      name,
      occasion,
      date,
      emailEnabled: true,
      createdAt: new Date(),
    };
    await database.collection('gift_reminders').insertOne(reminder);
    res.status(201).json({
      reminder: { id: reminder._id, name, occasion, date, emailEnabled: true, createdAt: reminder.createdAt },
    });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/account/reminders/:reminderId', requireUser, async (req, res, next) => {
  try {
    const result = await database.collection('gift_reminders').deleteOne({
      _id: req.params.reminderId,
      userId: req.user._id,
    });
    if (!result.deletedCount) return res.status(404).json({ error: 'That reminder could not be found.' });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get('/api/account/preferences', requireUser, async (req, res, next) => {
  try {
    res.json({
      email: req.user.email,
      orderEmail: req.user.preferences?.orderEmail === true,
      emailConfigured: Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL),
    });
  } catch (error) {
    next(error);
  }
});

app.put('/api/account/preferences', requireUser, async (req, res, next) => {
  try {
    if (typeof req.body.orderEmail !== 'boolean') {
      return res.status(400).json({ error: 'Choose whether to receive order updates by email.' });
    }
    if (req.body.orderEmail && (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL)) {
      return res.status(503).json({ error: 'Order email is not configured yet. Please try again later.' });
    }
    await database.collection('users').updateOne(
      { _id: req.user._id },
      { $set: { 'preferences.orderEmail': req.body.orderEmail, updatedAt: new Date() } },
    );
    res.json({ orderEmail: req.body.orderEmail });
  } catch (error) {
    next(error);
  }
});

app.get('/api/account/export', requireUser, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const [user, orders, reminders] = await Promise.all([
      database.collection('users').findOne(
        { _id: req.user._id },
        { projection: { name: 1, email: 1, phone: 1, addresses: 1, defaultAddressId: 1, preferences: 1, cartItems: 1, wishlist: 1, createdAt: 1, updatedAt: 1 } },
      ),
      database.collection('orders').find(
        { userId: req.user._id },
        { projection: { _id: 0, orderId: 1, customer: 1, email: 1, lines: 1, sub: 1, off: 1, couponCode: 1, ship: 1, giftFee: 1, total: 1, giftMessage: 1, status: 1, paymentMethod: 1, paymentStatus: 1, createdAt: 1 } },
      ).sort({ createdAt: -1 }).toArray(),
      database.collection('gift_reminders').find(
        { userId: req.user._id },
        { projection: { _id: 0, userId: 0, lastNotifiedFor: 0 } },
      ).toArray(),
    ]);
    if (!user) return res.status(404).json({ error: 'Your account could not be found.' });
    res.set('Content-Disposition', 'attachment; filename="gifters-hub-account-data.json"');
    res.json({
      exportedAt: new Date().toISOString(),
      profile: {
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        addresses: user.addresses || [],
        defaultAddressId: user.defaultAddressId || user.addresses?.[0]?.id || '',
        cartItems: user.cartItems || [],
        wishlist: user.wishlist || [],
        notifications: { orderEmail: user.preferences?.orderEmail === true },
        createdAt: user.createdAt || null,
        updatedAt: user.updatedAt || null,
      },
      orders,
      reminders,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/account/sessions', requireUser, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const token = readCookie(req, SESSION_COOKIE);
    const tokenHash = hashToken(token);
    const sessions = database.collection('sessions');
    const current = await sessions.findOne({ userId: req.user._id, tokenHash });
    if (!current) return res.status(401).json({ error: 'Your current session could not be found. Please sign in again.' });
    const activeSessions = await sessions.find(
      { userId: req.user._id, expiresAt: { $gt: new Date() } },
      { projection: { createdAt: 1, expiresAt: 1, tokenHash: 1 } },
    ).sort({ createdAt: -1 }).toArray();
    res.json({
      sessions: activeSessions.map(session => ({
        id: session._id.toString(),
        current: session._id.equals(current._id),
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/account/sessions/others', requireUser, async (req, res, next) => {
  try {
    const token = readCookie(req, SESSION_COOKIE);
    if (!/^[a-f0-9]{64}$/.test(token)) return res.status(401).json({ error: 'Please sign in again to manage sessions.' });
    const result = await database.collection('sessions').deleteMany({
      userId: req.user._id,
      tokenHash: { $ne: hashToken(token) },
    });
    res.json({ revoked: result.deletedCount });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/account/sessions/:sessionId', requireUser, async (req, res, next) => {
  try {
    if (!ObjectId.isValid(req.params.sessionId)) return res.status(400).json({ error: 'Choose a valid session.' });
    const token = readCookie(req, SESSION_COOKIE);
    const sessions = database.collection('sessions');
    const current = await sessions.findOne({ userId: req.user._id, tokenHash: hashToken(token) });
    const sessionId = new ObjectId(req.params.sessionId);
    if (current?._id.equals(sessionId)) {
      return res.status(400).json({ error: 'You cannot revoke the session you are using. Sign out to end it.' });
    }
    const result = await sessions.deleteOne({ _id: sessionId, userId: req.user._id });
    if (!result.deletedCount) return res.status(404).json({ error: 'That session could not be found.' });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get('/api/account/search', requireUser, async (req, res, next) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80).toLocaleLowerCase() : '';
    if (query.length < 2) return res.status(400).json({ error: 'Enter at least 2 characters to search your account.' });
    const user = await database.collection('users').findOne(
      { _id: req.user._id },
      { projection: { name: 1, email: 1, phone: 1, addresses: 1, wishlist: 1 } },
    );
    if (!user) return res.status(404).json({ error: 'Your account could not be found.' });

    const results = [];
    const matches = values => values.some(value => typeof value === 'string' && value.toLocaleLowerCase().includes(query));
    if (matches([user.name, user.email, user.phone])) {
      results.push({
        title: 'Personal details',
        detail: [user.name, user.email, user.phone].filter(Boolean).join(' · '),
        href: '/account/profile',
      });
    }
    for (const address of user.addresses || []) {
      const searchable = [address.label, address.name, address.phone, address.pincode, address.address, address.locality, address.city, address.state, address.country];
      if (matches(searchable)) {
        results.push({
          title: `${address.label || 'Saved'} address`,
          detail: searchable.filter(Boolean).join(', '),
          href: '/account/addresses',
        });
      }
    }
    const catalog = await getProducts();
    const wishlistProducts = (user.wishlist || [])
      .map(slug => catalog.find(product => product.slug === slug))
      .filter(Boolean);
    if (matches(wishlistProducts.flatMap(product => [product.name, product.subject, product.slug]))) {
      results.push({
        title: 'Saved gift ideas',
        detail: wishlistProducts.filter(product => matches([product.name, product.subject, product.slug])).map(product => product.name).join(' · '),
        href: '/account/wishlist',
      });
    }
    const reminders = await database.collection('gift_reminders').find(
      { userId: req.user._id },
      { projection: { name: 1, occasion: 1, date: 1 } },
    ).toArray();
    const matchingReminders = reminders.filter(reminder => matches([reminder.name, reminder.occasion, reminder.date]));
    if (matchingReminders.length) {
      results.push({
        title: 'Gift reminders',
        detail: matchingReminders.map(reminder => `${reminder.name} · ${reminder.occasion} · ${reminder.date}`).join(' | '),
        href: '/account/wishlist',
      });
    }
    const orders = await database.collection('orders')
      .find(
        { userId: req.user._id },
        { projection: { _id: 0, orderId: 1, status: 1, paymentStatus: 1, lines: 1 } },
      )
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    for (const order of orders) {
      const itemNames = (order.lines || []).map(line => line.name).filter(Boolean);
      if (matches([order.orderId, order.status, order.paymentStatus, ...itemNames])) {
        results.push({
          title: `Order ${order.orderId}`,
          detail: [order.status, order.paymentStatus, ...itemNames].filter(Boolean).join(' · '),
          href: '/account/orders',
        });
      }
    }
    res.json({ results: results.slice(0, 20) });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/account', requireUser, async (req, res, next) => {
  try {
    if (req.user.role === 'admin') {
      return res.status(403).json({ error: 'Administrator accounts are managed through backend credentials and cannot be deleted here.' });
    }
    if (req.body.confirmation !== 'DELETE') {
      return res.status(400).json({ error: 'Type DELETE to confirm account removal.' });
    }
    if (req.user.passwordHash) {
      if (typeof req.body.password !== 'string' ||
          !await passwordMatches(req.body.password, req.user.passwordSalt, req.user.passwordHash)) {
        return res.status(401).json({ error: 'Enter your current password to delete this account.' });
      }
    } else {
      if (!firebaseAuth || typeof req.body.idToken !== 'string' || req.body.idToken.length > 12000) {
        return res.status(401).json({ error: 'Verify your Google account again before deleting this account.' });
      }
      let identity;
      try {
        identity = await firebaseAuth.verifyIdToken(req.body.idToken, Boolean(firebaseServiceAccount));
      } catch (error) {
        if (['auth/argument-error', 'auth/id-token-expired', 'auth/id-token-revoked', 'auth/invalid-id-token'].includes(error.code)) {
          return res.status(401).json({ error: 'Google account verification failed. Please try again.' });
        }
        throw error;
      }
      if (identity.uid !== req.user.firebaseUid ||
          identity.firebase?.sign_in_provider !== 'google.com' ||
          identity.email_verified !== true) {
        return res.status(401).json({ error: 'Verify the Google account linked to this profile.' });
      }
    }

    const session = mongoClient.startSession();
    try {
      await session.withTransaction(async () => {
        await database.collection('orders').updateMany(
          { userId: req.user._id },
          {
            $unset: { userId: '', email: '' },
            $set: {
              'customer.name': 'Deleted customer',
              'customer.phone': '',
              'customer.pincode': '',
              'customer.address': '',
              giftMessage: '',
            },
          },
          { session },
        );
        await database.collection('sessions').deleteMany({ userId: req.user._id }, { session });
        await database.collection('gift_reminders').deleteMany({ userId: req.user._id }, { session });
        await database.collection('password_reset_codes').deleteOne({ _id: req.user.email }, { session });
        await database.collection('users').deleteOne({ _id: req.user._id }, { session });
      });
    } finally {
      await session.endSession();
    }
    const options = sessionCookieOptions();
    delete options.maxAge;
    res.clearCookie(SESSION_COOKIE, options);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/overview', requireAdmin, async (req, res, next) => {
  try {
    const usersPage = Number(req.query.usersPage || 1);
    const ordersPage = Number(req.query.ordersPage || 1);
    const orderStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    const ordersStatus = typeof req.query.ordersStatus === 'string' ? req.query.ordersStatus : '';
    const ordersQuery = typeof req.query.ordersQuery === 'string' ? req.query.ordersQuery.trim().slice(0, 100) : '';
    if (!Number.isSafeInteger(usersPage) || usersPage < 1 ||
        !Number.isSafeInteger(ordersPage) || ordersPage < 1) {
      return res.status(400).json({ error: 'Page numbers must be positive integers.' });
    }
    if (ordersStatus && !orderStatuses.includes(ordersStatus)) {
      return res.status(400).json({ error: 'Choose a valid order status filter.' });
    }

    const pageSize = 25;
    const userCollection = database.collection('users');
    const orderCollection = database.collection('orders');
    const productCollection = database.collection('products');
    const orderFilter = {};
    if (ordersStatus) orderFilter.status = ordersStatus;
    if (ordersQuery) {
      const queryPattern = new RegExp(escapeRegExp(ordersQuery), 'i');
      orderFilter.$or = [
        { orderId: queryPattern },
        { email: queryPattern },
        { 'customer.name': queryPattern },
      ];
    }
    const [userCount, orderCount, totals, users, orders, filteredOrderCount, productCount, activeProductCount, stockSummary, vyapaarSales, vyapaarPurchases, partiesSummary] = await Promise.all([
      userCollection.countDocuments(),
      orderCollection.countDocuments(),
      orderCollection.aggregate([{
        $group: {
          _id: null,
          orderValue: { $sum: { $ifNull: ['$total', 0] } },
          pendingPayments: {
            $sum: { $cond: [{ $eq: [{ $ifNull: ['$paymentStatus', 'pending'] }, 'pending'] }, 1, 0] },
          },
        },
      }]).toArray(),
      userCollection.find({}, { projection: { passwordHash: 0, passwordSalt: 0 } })
        .sort({ createdAt: -1 }).skip((usersPage - 1) * pageSize).limit(pageSize).toArray(),
      orderCollection.find(orderFilter)
        .sort({ createdAt: -1 }).skip((ordersPage - 1) * pageSize).limit(pageSize).toArray(),
      orderCollection.countDocuments(orderFilter),
      productCollection.countDocuments({ archived: { $ne: true } }),
      productCollection.countDocuments({ archived: { $ne: true }, available: true }),
      productCollection.aggregate([
        { $match: { archived: { $ne: true } } },
        { $group: {
          _id: null,
          stockUnits: { $sum: { $ifNull: ['$stock', 0] } },
          lowStockCount: { $sum: { $cond: [
            { $and: [
              { $gt: [{ $ifNull: ['$lowStockThreshold', 0] }, 0] },
              { $lte: [{ $ifNull: ['$stock', 0] }, { $ifNull: ['$lowStockThreshold', 0] }] },
            ] },
            1,
            0,
          ] } },
        } },
      ]).toArray(),
      database.collection('vyapaar_sales').aggregate([
        { $group: {
          _id: null,
          invoiceCount: { $sum: 1 },
          salesValuePaise: { $sum: { $ifNull: ['$totalPaise', 0] } },
          receivablesPaise: { $sum: { $ifNull: ['$balanceDuePaise', 0] } },
        } },
      ]).toArray(),
      database.collection('vyapaar_purchases').aggregate([
        { $group: {
          _id: null,
          purchaseCount: { $sum: 1 },
          purchaseValuePaise: { $sum: { $ifNull: ['$totalPaise', 0] } },
          payablesPaise: { $sum: { $ifNull: ['$balanceDuePaise', 0] } },
        } },
      ]).toArray(),
      database.collection('vyapaar_parties').aggregate([
        { $match: { archived: { $ne: true } } },
        { $group: {
          _id: null,
          customerCount: { $sum: { $cond: [{ $in: ['$type', ['customer', 'both']] }, 1, 0] } },
          supplierCount: { $sum: { $cond: [{ $in: ['$type', ['supplier', 'both']] }, 1, 0] } },
        } },
      ]).toArray(),
    ]);

    res.json({
      summary: {
        userCount,
        orderCount,
        orderValue: totals[0]?.orderValue || 0,
        pendingPayments: totals[0]?.pendingPayments || 0,
        productCount,
        activeProductCount,
        stockUnits: stockSummary[0]?.stockUnits || 0,
        lowStockCount: stockSummary[0]?.lowStockCount || 0,
        invoiceCount: vyapaarSales[0]?.invoiceCount || 0,
        salesValue: (vyapaarSales[0]?.salesValuePaise || 0) / 100,
        receivables: (vyapaarSales[0]?.receivablesPaise || 0) / 100,
        purchaseCount: vyapaarPurchases[0]?.purchaseCount || 0,
        purchaseValue: (vyapaarPurchases[0]?.purchaseValuePaise || 0) / 100,
        payables: (vyapaarPurchases[0]?.payablesPaise || 0) / 100,
        partyCustomerCount: partiesSummary[0]?.customerCount || 0,
        supplierCount: partiesSummary[0]?.supplierCount || 0,
      },
      users: {
        page: usersPage,
        pageSize,
        total: userCount,
        items: users.map(({ _id, ...user }) => ({
          ...user,
          id: _id.toString(),
          role: user.role || 'customer',
        })),
      },
      orders: {
        page: ordersPage,
        pageSize,
        total: filteredOrderCount,
        items: orders.map(({ _id, userId, ...order }) => ({
          ...order,
          id: _id.toString(),
          userId: userId?.toString() || '',
          status: order.status || 'pending',
          paymentMethod: order.paymentMethod || 'cash-on-delivery',
          paymentStatus: order.paymentStatus || 'pending',
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/products/barcode/:barcode', requireAdmin, async (req, res, next) => {
  try {
    const barcode = req.params.barcode.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{4,80}$/.test(barcode)) return res.status(400).json({ error: 'Enter a valid barcode.' });
    const product = await database.collection('products').findOne(
      { barcode },
      { projection: { _id: 0, passwordHash: 0, passwordSalt: 0 } },
    );
    if (!product) return res.status(404).json({ error: 'No item with that barcode exists in the catalogue.' });
    res.json({ item: product });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/settings/business', requireAdmin, async (req, res, next) => {
  try {
    const settings = await database.collection('vyapaar_settings').findOne({ _id: 'business' });
    res.json({ settings: settings || {
      businessName: "The Gifter's Hub",
      phone: '',
      email: '',
      address: '',
      gstin: '',
      currency: 'INR',
      invoicePrefix: 'GH-INV',
      invoiceTerms: 'Thank you for your business.',
    } });
  } catch (error) {
    next(error);
  }
});

app.put('/api/admin/settings/business', requireAdmin, async (req, res, next) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const businessName = typeof body.businessName === 'string' ? body.businessName.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const address = typeof body.address === 'string' ? body.address.trim() : '';
  const gstin = typeof body.gstin === 'string' ? body.gstin.trim().toUpperCase() : '';
  const invoicePrefix = typeof body.invoicePrefix === 'string' ? body.invoicePrefix.trim().toUpperCase() : '';
  const invoiceTerms = typeof body.invoiceTerms === 'string' ? body.invoiceTerms.trim() : '';
  if (businessName.length < 2 || businessName.length > 100 || phone.length > 20 ||
      (phone && !/^\+?[0-9 ()-]{7,20}$/.test(phone)) ||
      (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) ||
      address.length > 500 || (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) ||
      !/^[A-Z0-9-]{2,12}$/.test(invoicePrefix) || invoiceTerms.length > 1000) {
    return res.status(400).json({ error: 'Review business name, contact, GSTIN, invoice prefix, and terms.' });
  }
  try {
    const settings = {
      _id: 'business',
      businessName,
      phone,
      email,
      address,
      gstin,
      currency: 'INR',
      invoicePrefix,
      invoiceTerms,
      updatedBy: req.user._id.toString(),
      updatedAt: new Date(),
    };
    await database.collection('vyapaar_settings').replaceOne({ _id: 'business' }, settings, { upsert: true });
    res.json({ settings });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/products', requireAdmin, async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const lowStockOnly = req.query.lowStock === 'true';
    if (!Number.isSafeInteger(page) || page < 1) return res.status(400).json({ error: 'Page number must be a positive integer.' });
    if (status && !['active', 'coming-soon', 'out-of-stock', 'archived'].includes(status)) {
      return res.status(400).json({ error: 'Choose a valid catalogue status.' });
    }

    const filter = {};
    if (status === 'archived') filter.archived = true;
    else if (status) {
      filter.archived = { $ne: true };
      filter.status = status;
    }
    if (lowStockOnly) {
      filter.$expr = {
        $and: [
          { $gt: [{ $ifNull: ['$lowStockThreshold', 0] }, 0] },
          { $lte: [{ $ifNull: ['$stock', 0] }, { $ifNull: ['$lowStockThreshold', 0] }] },
        ],
      };
    }
    if (query) {
      const escapedQuery = escapeRegExp(query);
      filter.$and = [...(filter.$and || []), { $or: [
        { name: { $regex: escapedQuery, $options: 'i' } },
        { slug: { $regex: escapedQuery, $options: 'i' } },
        { subject: { $regex: escapedQuery, $options: 'i' } },
        { sku: { $regex: escapedQuery, $options: 'i' } },
        { barcode: { $regex: escapedQuery, $options: 'i' } },
      ] }];
    }
    const collection = database.collection('products');
    const pageSize = 20;
    const [total, items] = await Promise.all([
      collection.countDocuments(filter),
      collection.find(filter, { projection: { _id: 0 } })
        .sort({ name: 1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
    ]);
    res.json({ page, pageSize, total, items });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/categories', requireAdmin, async (req, res, next) => {
  try {
    const categories = await database.collection('vyapaar_categories').find({ archived: { $ne: true } }).sort({ name: 1 }).toArray();
    const counts = await database.collection('products').aggregate([
      { $match: { archived: { $ne: true } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]).toArray();
    const countBySlug = new Map(counts.map(entry => [entry._id, entry.count]));
    res.json({ items: categories.map(({ _id, ...category }) => ({ ...category, id: _id.toString(), itemCount: countBySlug.get(category.slug) || 0 })) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/categories', requireAdmin, async (req, res, next) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const slug = typeof req.body?.slug === 'string'
    ? req.body.slug.trim().toLowerCase()
    : name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (name.length < 2 || name.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
    return res.status(400).json({ error: 'Enter a category name and valid URL key.' });
  }
  try {
    const now = new Date();
    const category = { slug, name, archived: false, createdAt: now, updatedAt: now };
    await database.collection('vyapaar_categories').insertOne(category);
    res.status(201).json(category);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'A category with that URL key already exists.' });
    next(error);
  }
});

app.patch('/api/admin/categories/:slug', requireAdmin, async (req, res, next) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const archived = req.body?.archived === true;
  if (!archived && (name.length < 2 || name.length > 80)) return res.status(400).json({ error: 'Category name must be between 2 and 80 characters.' });
  try {
    const categories = database.collection('vyapaar_categories');
    const category = await categories.findOne({ slug: req.params.slug, archived: { $ne: true } });
    if (!category) return res.status(404).json({ error: 'Category not found.' });
    if (archived) {
      const uses = await database.collection('products').countDocuments({ category: category.slug, archived: { $ne: true } });
      if (uses) return res.status(409).json({ error: 'Move or archive the category items before archiving this category.' });
    }
    await categories.updateOne(
      { _id: category._id },
      { $set: archived ? { archived: true, updatedAt: new Date() } : { name, updatedAt: new Date() } },
    );
    res.json({ slug: category.slug, name: archived ? category.name : name, archived });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/units', requireAdmin, async (req, res, next) => {
  try {
    const items = await database.collection('vyapaar_units').find({ archived: { $ne: true } }).sort({ name: 1 }).toArray();
    const counts = await database.collection('products').aggregate([
      { $match: { archived: { $ne: true } } },
      { $group: { _id: '$unit', count: { $sum: 1 } } },
    ]).toArray();
    const countByName = new Map(counts.map(entry => [entry._id, entry.count]));
    res.json({ items: items.map(({ _id, ...unit }) => ({ ...unit, id: _id.toString(), itemCount: countByName.get(unit.name) || 0 })) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/units', requireAdmin, async (req, res, next) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().toLowerCase() : '';
  if (!/^[a-z0-9][a-z0-9 -]{0,23}$/.test(name)) return res.status(400).json({ error: 'Use a valid unit name of up to 24 characters.' });
  try {
    const unit = { name, archived: false, createdAt: new Date(), updatedAt: new Date() };
    await database.collection('vyapaar_units').insertOne(unit);
    res.status(201).json(unit);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'That unit already exists.' });
    next(error);
  }
});

app.delete('/api/admin/units/:name', requireAdmin, async (req, res, next) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const uses = await database.collection('products').countDocuments({ unit: name, archived: { $ne: true } });
    if (uses) return res.status(409).json({ error: 'Change the unit on its products before archiving it.' });
    const result = await database.collection('vyapaar_units').updateOne(
      { name, archived: { $ne: true } },
      { $set: { archived: true, updatedAt: new Date() } },
    );
    if (!result.matchedCount) return res.status(404).json({ error: 'Unit not found.' });
    res.json({ name, archived: true });
  } catch (error) {
    next(error);
  }
});

function parseVyapaarParty(input, existing = {}) {
  const name = typeof input?.name === 'string' ? input.name.trim() : '';
  const type = input?.type;
  const phone = typeof input?.phone === 'string' ? input.phone.trim() : '';
  const email = typeof input?.email === 'string' ? input.email.trim().toLowerCase() : '';
  const address = typeof input?.address === 'string' ? input.address.trim() : '';
  const gstin = typeof input?.gstin === 'string' ? input.gstin.trim().toUpperCase() : '';
  const notes = typeof input?.notes === 'string' ? input.notes.trim() : '';
  if (name.length < 2 || name.length > 120) return { error: 'Party name must be between 2 and 120 characters.' };
  if (!['customer', 'supplier', 'both'].includes(type)) return { error: 'Choose customer, supplier, or both.' };
  if (phone && !/^\d{10}$/.test(phone)) return { error: 'Enter a valid 10-digit phone number.' };
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return { error: 'Enter a valid email address.' };
  if (address.length > 500 || notes.length > 1000) return { error: 'Address or notes exceed the allowed length.' };
  if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) return { error: 'Enter a valid GSTIN format.' };
  return {
    party: {
      ...(existing || {}),
      id: existing.id || crypto.randomUUID(),
      name,
      type,
      phone,
      email,
      address,
      gstin,
      notes,
      archived: false,
      ...(existing.createdAt ? {} : { createdAt: new Date() }),
      updatedAt: new Date(),
    },
  };
}

app.get('/api/admin/parties', requireAdmin, async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    const type = typeof req.query.type === 'string' ? req.query.type : '';
    if (!Number.isSafeInteger(page) || page < 1) return res.status(400).json({ error: 'Page number must be a positive integer.' });
    if (type && !['customer', 'supplier', 'both'].includes(type)) return res.status(400).json({ error: 'Choose a valid party type filter.' });
    const filter = { archived: { $ne: true } };
    if (type === 'customer') filter.type = { $in: ['customer', 'both'] };
    else if (type === 'supplier') filter.type = { $in: ['supplier', 'both'] };
    else if (type) filter.type = type;
    if (query) {
      const pattern = escapeRegExp(query);
      filter.$or = [
        { name: { $regex: pattern, $options: 'i' } },
        { phone: { $regex: pattern, $options: 'i' } },
        { email: { $regex: pattern, $options: 'i' } },
        { gstin: { $regex: pattern, $options: 'i' } },
      ];
    }
    const collection = database.collection('vyapaar_parties');
    const pageSize = 25;
    const [total, items] = await Promise.all([
      collection.countDocuments(filter),
      collection.find(filter).sort({ name: 1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
    ]);
    res.json({ page, pageSize, total, items });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/parties', requireAdmin, async (req, res, next) => {
  try {
    const parsed = parseVyapaarParty(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    await database.collection('vyapaar_parties').insertOne(parsed.party);
    res.status(201).json(parsed.party);
  } catch (error) {
    next(error);
  }
});

app.put('/api/admin/parties/:id', requireAdmin, async (req, res, next) => {
  try {
    const collection = database.collection('vyapaar_parties');
    const existing = await collection.findOne({ id: req.params.id, archived: { $ne: true } });
    if (!existing) return res.status(404).json({ error: 'Party not found.' });
    const parsed = parseVyapaarParty(req.body, existing);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    await collection.replaceOne({ id: existing.id }, parsed.party);
    res.json(parsed.party);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/admin/parties/:id', requireAdmin, async (req, res, next) => {
  try {
    const result = await database.collection('vyapaar_parties').updateOne(
      { id: req.params.id, archived: { $ne: true } },
      { $set: { archived: true, updatedAt: new Date() } },
    );
    if (!result.matchedCount) return res.status(404).json({ error: 'Party not found.' });
    res.json({ id: req.params.id, archived: true });
  } catch (error) {
    next(error);
  }
});

function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

app.get('/api/admin/products/export', requireAdmin, async (req, res, next) => {
  try {
    const productsCollection = database.collection('products');
    const total = await productsCollection.countDocuments({});
    if (total > 10000) return res.status(413).json({ error: 'The catalogue is too large for a single export. Narrow the export or contact support.' });
    const items = await productsCollection.find({}, { projection: { _id: 0 } }).sort({ name: 1 }).limit(10000).toArray();
    const fields = ['name', 'slug', 'sku', 'barcode', 'category', 'subject', 'unit', 'purchasePrice', 'price', 'mrp', 'taxRate', 'stock', 'lowStockThreshold', 'status', 'image'];
    const rows = [fields.map(csvCell).join(',')];
    for (const item of items) rows.push(fields.map(field => csvCell(item[field])).join(','));
    res.set('Content-Disposition', 'attachment; filename="vyapaar-items.csv"');
    res.type('text/csv; charset=utf-8').send(`\uFEFF${rows.join('\r\n')}`);
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/products/import', requireAdmin, async (req, res, next) => {
  try {
    const rows = req.body?.rows;
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > 500) {
      return res.status(400).json({ error: 'Import between 1 and 500 product rows at a time.' });
    }
    const collection = database.collection('products');
    const seenSlugs = new Set();
    const seenSkus = new Set();
    const seenBarcodes = new Set();
    const results = [];
    for (let index = 0; index < rows.length; index += 1) {
      const rowNumber = index + 2;
      const row = rows[index];
      const parsed = parseAdminProduct({
        ...row,
        price: row.price === '' || row.price === undefined ? null : Number(row.price),
        mrp: row.mrp === '' || row.mrp === undefined ? null : Number(row.mrp),
        purchasePrice: row.purchasePrice === '' || row.purchasePrice === undefined ? null : Number(row.purchasePrice),
        taxRate: row.taxRate === '' || row.taxRate === undefined ? 0 : Number(row.taxRate),
        lowStockThreshold: row.lowStockThreshold === '' || row.lowStockThreshold === undefined ? 0 : Number(row.lowStockThreshold),
        status: row.status || 'coming-soon',
        gallery: Array.isArray(row.gallery) ? row.gallery : undefined,
      });
      if (parsed.error) {
        results.push({ row: rowNumber, status: 'failed', error: parsed.error });
        continue;
      }
      const product = parsed.product;
      if (!await database.collection('vyapaar_categories').findOne({ slug: product.category, archived: { $ne: true } })) {
        results.push({ row: rowNumber, status: 'failed', error: 'Choose an existing active category.' });
        continue;
      }
      const slugKey = product.slug.toLowerCase();
      const skuKey = product.sku?.toUpperCase();
      const barcodeKey = product.barcode?.toUpperCase();
      if (seenSlugs.has(slugKey) || (skuKey && seenSkus.has(skuKey)) || (barcodeKey && seenBarcodes.has(barcodeKey))) {
        results.push({ row: rowNumber, status: 'failed', error: 'This row duplicates a product identifier in the import file.' });
        continue;
      }
      seenSlugs.add(slugKey);
      if (skuKey) seenSkus.add(skuKey);
      if (barcodeKey) seenBarcodes.add(barcodeKey);
      try {
        const identifierConflict = await findProductIdentifierConflict(collection, product);
        if (identifierConflict) {
          results.push({ row: rowNumber, status: 'failed', error: identifierConflict });
          continue;
        }
        await collection.insertOne(product);
        results.push({ row: rowNumber, status: 'imported', slug: product.slug });
      } catch (error) {
        if (error.code === 11000) {
          results.push({ row: rowNumber, status: 'failed', error: 'The product slug, SKU, or barcode is already in use.' });
          continue;
        }
        throw error;
      }
    }
    res.status(results.some(result => result.status === 'failed') ? 207 : 201).json({
      imported: results.filter(result => result.status === 'imported').length,
      failed: results.filter(result => result.status === 'failed').length,
      results,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/products', requireAdmin, async (req, res, next) => {
  try {
    const parsed = parseAdminProduct(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const collection = database.collection('products');
    if (!await database.collection('vyapaar_categories').findOne({ slug: parsed.product.category, archived: { $ne: true } })) {
      return res.status(400).json({ error: 'Choose an existing active category.' });
    }
    if (await collection.findOne({ slug: parsed.product.slug })) {
      return res.status(409).json({ error: 'A product with this URL slug already exists.' });
    }
    const identifierConflict = await findProductIdentifierConflict(collection, parsed.product);
    if (identifierConflict) return res.status(409).json({ error: identifierConflict });
    await collection.insertOne(parsed.product);
    res.status(201).json(parsed.product);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'A product with this URL slug already exists.' });
    next(error);
  }
});

app.put('/api/admin/products/:slug', requireAdmin, async (req, res, next) => {
  try {
    const collection = database.collection('products');
    const existing = await collection.findOne({ slug: req.params.slug }, { projection: { _id: 0 } });
    if (!existing) return res.status(404).json({ error: 'Product not found.' });
    const parsed = parseAdminProduct(req.body, existing);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    if (!await database.collection('vyapaar_categories').findOne({ slug: parsed.product.category, archived: { $ne: true } })) {
      return res.status(400).json({ error: 'Choose an existing active category.' });
    }
    const identifierConflict = await findProductIdentifierConflict(collection, parsed.product, existing.slug);
    if (identifierConflict) return res.status(409).json({ error: identifierConflict });
    const productChanges = { ...parsed.product };
    delete productChanges.stock;
    const changes = { $set: productChanges };
    const unset = {};
    for (const field of ['sku', 'barcode']) {
      if (!parsed.product[field] && existing[field]) unset[field] = '';
    }
    if (Object.keys(unset).length) changes.$unset = unset;
    await collection.updateOne({ slug: existing.slug }, changes);
    res.json(parsed.product);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/admin/products/:slug', requireAdmin, async (req, res, next) => {
  try {
    const result = await database.collection('products').updateOne(
      { slug: req.params.slug, archived: { $ne: true } },
      { $set: { archived: true } },
    );
    if (!result.matchedCount) return res.status(404).json({ error: 'Product not found.' });
    res.json({ slug: req.params.slug, archived: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/stock', requireAdmin, async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    if (!Number.isSafeInteger(page) || page < 1) return res.status(400).json({ error: 'Page number must be a positive integer.' });

    const filter = { archived: { $ne: true } };
    if (query) {
      const queryPattern = escapeRegExp(query);
      filter.$or = [
        { name: { $regex: queryPattern, $options: 'i' } },
        { slug: { $regex: queryPattern, $options: 'i' } },
        { sku: { $regex: queryPattern, $options: 'i' } },
        { barcode: { $regex: queryPattern, $options: 'i' } },
      ];
    }

    const pageSize = 30;
    const [total, items, movements] = await Promise.all([
      database.collection('products').countDocuments(filter),
      database.collection('products').find(filter, {
        projection: { _id: 0, slug: 1, name: 1, sku: 1, barcode: 1, category: 1, unit: 1, stock: 1, lowStockThreshold: 1 },
      }).sort({ name: 1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
      database.collection('stock_movements').find({}, { projection: { _id: 0 } })
        .sort({ createdAt: -1 }).limit(30).toArray(),
    ]);
    res.json({
      page,
      pageSize,
      total,
      items: items.map(item => ({
        ...item,
        stock: Number.isSafeInteger(item.stock) ? item.stock : 0,
        lowStockThreshold: Number.isSafeInteger(item.lowStockThreshold) ? item.lowStockThreshold : 0,
      })),
      movements,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/stock/adjustments', requireAdmin, async (req, res, next) => {
  const { slug, mode, reason, requestId } = req.body || {};
  const quantity = req.body?.quantity;
  if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return res.status(400).json({ error: 'Choose a valid inventory item.' });
  }
  if (!['add', 'remove', 'set', 'opening'].includes(mode)) {
    return res.status(400).json({ error: 'Choose whether to add, remove, or set stock.' });
  }
  if (!Number.isSafeInteger(quantity) || quantity < 0 || (mode !== 'set' && quantity === 0)) {
    return res.status(400).json({ error: 'Enter a valid whole-number stock quantity.' });
  }
  if (typeof reason !== 'string' || reason.trim().length < 3 || reason.trim().length > 500) {
    return res.status(400).json({ error: 'Enter an adjustment reason between 3 and 500 characters.' });
  }
  if (typeof requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(requestId)) {
    return res.status(400).json({ error: 'The stock adjustment request is invalid. Please submit again.' });
  }

  const session = mongoClient.startSession();
  try {
    let savedMovement;
    await session.withTransaction(async () => {
      const movementCollection = database.collection('stock_movements');
      const previousRequest = await movementCollection.findOne({ requestId }, { session });
      if (previousRequest) {
        if (previousRequest.slug !== slug) {
          const conflict = new Error('This adjustment request was already used for a different item.');
          conflict.statusCode = 409;
          throw conflict;
        }
        savedMovement = previousRequest;
        return;
      }

      const item = await database.collection('products').findOne(
        { slug, archived: { $ne: true } },
        { session, projection: { slug: 1, name: 1, stock: 1 } },
      );
      if (!item) {
        const notFound = new Error('Inventory item not found.');
        notFound.statusCode = 404;
        throw notFound;
      }

      const previousStock = Number.isSafeInteger(item.stock) && item.stock >= 0 ? item.stock : 0;
      if (mode === 'opening') {
        const priorMovements = await movementCollection.countDocuments({ slug }, { session });
        if (previousStock !== 0 || priorMovements > 0) {
          const alreadyOpened = new Error('Opening stock can only be recorded once, before other stock movements.');
          alreadyOpened.statusCode = 409;
          throw alreadyOpened;
        }
      }
      const nextStock = mode === 'set' || mode === 'opening'
        ? quantity
        : mode === 'add'
          ? previousStock + quantity
          : previousStock - quantity;
      if (!Number.isSafeInteger(nextStock) || nextStock < 0) {
        const invalidStock = new Error('This adjustment would make stock negative.');
        invalidStock.statusCode = 400;
        throw invalidStock;
      }
      if (nextStock === previousStock) {
        const unchanged = new Error('The new stock quantity is the same as the current quantity.');
        unchanged.statusCode = 400;
        throw unchanged;
      }

      const movement = {
        requestId,
        slug,
        itemName: item.name,
        type: mode === 'opening' ? 'opening-stock' : 'manual-adjustment',
        mode,
        quantity: nextStock - previousStock,
        previousStock,
        newStock: nextStock,
        reason: reason.trim(),
        createdBy: req.user._id.toString(),
        createdByEmail: req.user.email,
        createdAt: new Date(),
      };
      const stockMatch = item.stock === undefined ? { stock: { $exists: false } } : { stock: item.stock };
      const update = await database.collection('products').updateOne(
        { slug, ...stockMatch },
        { $set: { stock: nextStock } },
        { session },
      );
      if (!update.matchedCount) {
        const conflict = new Error('Stock changed while this adjustment was being saved. Refresh and try again.');
        conflict.statusCode = 409;
        throw conflict;
      }
      await movementCollection.insertOne(movement, { session });
      savedMovement = movement;
    });
    res.status(201).json(savedMovement);
  } catch (error) {
    if (error.code === 11000) {
      const previousRequest = await database.collection('stock_movements').findOne({ requestId }, { projection: { _id: 0 } });
      if (previousRequest?.slug === slug) return res.json(previousRequest);
      return res.status(409).json({ error: 'This adjustment request has already been recorded.' });
    }
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  } finally {
    await session.endSession();
  }
});

function amountToPaise(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  const scaled = value * 100;
  const paise = Math.round(scaled);
  return Number.isSafeInteger(paise) && Math.abs(scaled - paise) < 0.000001 ? paise : null;
}

function defaultCashAccountId(method) {
  return method === 'cash' ? 'cash-default' : 'bank-default';
}

async function insertCashbookEntry({ requestId, accountId, amountPaise, direction, type, description, reference, actor, session }) {
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) return;
  const accounts = database.collection('vyapaar_accounts');
  const account = await accounts.findOne({ id: accountId, archived: { $ne: true } }, { session });
  if (!account) {
    const invalidAccount = new Error('Choose an active cash or bank account.');
    invalidAccount.statusCode = 400;
    throw invalidAccount;
  }
  await database.collection('vyapaar_cashbook').insertOne({
    requestId,
    leg: 'main',
    accountId: account.id,
    accountName: account.name,
    amountPaise: direction === 'in' ? amountPaise : -amountPaise,
    type,
    description,
    reference: reference || '',
    createdBy: actor?._id?.toString() || '',
    createdByEmail: actor?.email || '',
    createdAt: new Date(),
  }, { session });
}

function parseDateRange(query) {
  const from = typeof query.from === 'string' ? query.from : '';
  const to = typeof query.to === 'string' ? query.to : '';
  const isDateOnly = value => {
    if (!value) return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  if (!isDateOnly(from) || !isDateOnly(to)) return null;
  const range = {};
  if (from) range.$gte = new Date(`${from}T00:00:00.000Z`);
  if (to) {
    const nextDay = new Date(`${to}T00:00:00.000Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    range.$lt = nextDay;
  }
  if (range.$gte && range.$lt && range.$gte >= range.$lt) return null;
  return Object.keys(range).length ? range : {};
}

function serializeSale(sale) {
  const { _id, subtotalPaise, discountPaise, taxPaise, totalPaise, amountPaidPaise, balanceDuePaise, lines, ...details } = sale;
  return {
    ...details,
    id: _id?.toString() || details.invoiceNumber,
    subtotal: subtotalPaise / 100,
    discount: discountPaise / 100,
    tax: taxPaise / 100,
    total: totalPaise / 100,
    amountPaid: amountPaidPaise / 100,
    balanceDue: balanceDuePaise / 100,
    lineCount: lines.length,
    lines: lines.map(line => ({
      ...line,
      unitPrice: line.unitPricePaise / 100,
      gross: line.grossPaise / 100,
      discount: line.discountPaise / 100,
      tax: line.taxPaise / 100,
      total: line.totalPaise / 100,
      unitPricePaise: undefined,
      grossPaise: undefined,
      discountPaise: undefined,
      taxPaise: undefined,
      totalPaise: undefined,
    })),
  };
}

function serializePayment(payment) {
  const { _id, amountPaise, ...details } = payment;
  return { ...details, id: _id?.toString(), amount: amountPaise / 100 };
}

function serializePurchase(purchase) {
  const { _id, subtotalPaise, taxPaise, totalPaise, amountPaidPaise, balanceDuePaise, supplierRefundDuePaise, lines, ...details } = purchase;
  return {
    ...details,
    id: _id?.toString() || details.purchaseNumber,
    subtotal: subtotalPaise / 100,
    tax: taxPaise / 100,
    total: totalPaise / 100,
    amountPaid: amountPaidPaise / 100,
    balanceDue: balanceDuePaise / 100,
    supplierRefundDue: (supplierRefundDuePaise || 0) / 100,
    lines: lines.map(line => ({ ...line, unitCost: line.unitCostPaise / 100, total: line.totalPaise / 100, unitCostPaise: undefined, totalPaise: undefined })),
  };
}

app.get('/api/admin/purchases', requireAdmin, async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    if (!Number.isSafeInteger(page) || page < 1) return res.status(400).json({ error: 'Page number must be a positive integer.' });
    const filter = {};
    if (query) {
      const pattern = escapeRegExp(query);
      filter.$or = [
        { purchaseNumber: { $regex: pattern, $options: 'i' } },
        { supplierName: { $regex: pattern, $options: 'i' } },
        { billNumber: { $regex: pattern, $options: 'i' } },
      ];
    }
    const pageSize = 25;
    const collection = database.collection('vyapaar_purchases');
    const [total, items] = await Promise.all([
      collection.countDocuments(filter),
      collection.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
    ]);
    res.json({ page, pageSize, total, items: items.map(serializePurchase) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/purchases', requireAdmin, async (req, res, next) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const requestId = typeof body.requestId === 'string' ? body.requestId : '';
  const supplierId = typeof body.supplierId === 'string' ? body.supplierId : '';
  const billNumber = typeof body.billNumber === 'string' ? body.billNumber.trim().slice(0, 100) : '';
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';
  const initialPaymentPaise = amountToPaise(body.initialPayment ?? 0);
  if (!/^[a-f0-9-]{36}$/i.test(requestId)) return res.status(400).json({ error: 'The purchase request is invalid. Please submit again.' });
  if (!supplierId || supplierId.length > 80 || billNumber.length < 1) return res.status(400).json({ error: 'Choose a supplier and enter the supplier bill number.' });
  if (!Array.isArray(body.lines) || body.lines.length < 1 || body.lines.length > 100 ||
      body.lines.some(line => !line || typeof line.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(line.slug) ||
        !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 10000 ||
        amountToPaise(line.unitCost) === null) ||
      new Set(body.lines.map(line => line?.slug)).size !== body.lines.length) {
    return res.status(400).json({ error: 'Add unique items with valid quantities and unit costs.' });
  }
  if (initialPaymentPaise === null) return res.status(400).json({ error: 'The initial payment must be a non-negative amount with up to two decimal places.' });

  const session = mongoClient.startSession();
  try {
    let savedPurchase;
    await session.withTransaction(async () => {
      const purchases = database.collection('vyapaar_purchases');
      const existing = await purchases.findOne({ requestId }, { session });
      if (existing) { savedPurchase = existing; return; }
      const supplier = await database.collection('vyapaar_parties').findOne(
        { id: supplierId, archived: { $ne: true }, type: { $in: ['supplier', 'both'] } },
        { session },
      );
      if (!supplier) {
        const missingSupplier = new Error('Selected supplier no longer exists. Choose another supplier.');
        missingSupplier.statusCode = 409;
        throw missingSupplier;
      }
      const productCollection = database.collection('products');
      const purchaseLines = [];
      let subtotalPaise = 0;
      let taxPaise = 0;
      for (const submittedLine of body.lines) {
        const product = await productCollection.findOne(
          { slug: submittedLine.slug, archived: { $ne: true } },
          { session, projection: { _id: 0, slug: 1, name: 1, stock: 1, unit: 1, taxRate: 1 } },
        );
        if (!product) {
          const missingProduct = new Error('An item in this purchase no longer exists in the catalogue.');
          missingProduct.statusCode = 409;
          throw missingProduct;
        }
        const unitCostPaise = amountToPaise(submittedLine.unitCost);
        const taxRate = Number.isFinite(product.taxRate) ? product.taxRate : 0;
        const lineBasePaise = unitCostPaise * submittedLine.quantity;
        const lineTaxPaise = Math.round(lineBasePaise * taxRate / 100);
        const lineTotalPaise = lineBasePaise + lineTaxPaise;
        if (![lineBasePaise, lineTaxPaise, lineTotalPaise, subtotalPaise + lineBasePaise, taxPaise + lineTaxPaise].every(Number.isSafeInteger)) {
          const invalidTotals = new Error('Purchase totals exceed the supported amount.');
          invalidTotals.statusCode = 400;
          throw invalidTotals;
        }
        subtotalPaise += lineBasePaise;
        taxPaise += lineTaxPaise;
        purchaseLines.push({
          slug: product.slug,
          name: product.name,
          quantity: submittedLine.quantity,
          unit: product.unit || 'piece',
          unitCostPaise,
          taxRate,
          totalPaise: lineTotalPaise,
        });
      }
      const totalPaise = subtotalPaise + taxPaise;
      if (!Number.isSafeInteger(totalPaise)) {
        const invalidTotal = new Error('Purchase total exceeds the supported amount.');
        invalidTotal.statusCode = 400;
        throw invalidTotal;
      }
      if (initialPaymentPaise > totalPaise) {
        const excessPayment = new Error('Initial payment cannot exceed the purchase total.');
        excessPayment.statusCode = 400;
        throw excessPayment;
      }
      const now = new Date();
      const purchaseNumber = `GH-PUR-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
      savedPurchase = {
        requestId,
        purchaseNumber,
        billNumber,
        supplierId: supplier.id,
        supplierName: supplier.name,
        note,
        lines: purchaseLines,
        subtotalPaise,
        taxPaise,
        totalPaise,
        amountPaidPaise: initialPaymentPaise,
        balanceDuePaise: totalPaise - initialPaymentPaise,
        status: initialPaymentPaise === totalPaise ? 'paid' : initialPaymentPaise > 0 ? 'partially-paid' : 'unpaid',
        createdByEmail: req.user.email,
        createdAt: now,
      };
      await purchases.insertOne(savedPurchase, { session });
      await insertCashbookEntry({
        requestId: `purchase-payment:${requestId}:initial`,
        accountId: typeof body.accountId === 'string' ? body.accountId : 'cash-default',
        amountPaise: initialPaymentPaise,
        direction: 'out',
        type: 'purchase-payment',
        description: `Initial payment for ${purchaseNumber}`,
        reference: billNumber,
        actor: req.user,
        session,
      });
      for (const line of purchaseLines) {
        const product = await productCollection.findOne(
          { slug: line.slug, archived: { $ne: true } },
          { session, projection: { _id: 0, stock: 1, name: 1 } },
        );
        if (!product) {
          const missingProduct = new Error(`Item ${line.name} is no longer available.`);
          missingProduct.statusCode = 409;
          throw missingProduct;
        }
        const stockMatch = product.stock === undefined ? { stock: { $exists: false } } : { stock: product.stock };
        if (product.stock !== undefined && product.stock !== null && (!Number.isSafeInteger(product.stock) || product.stock < 0)) {
          const invalidStock = new Error(`Stock for ${product.name} is invalid. Correct it before recording this purchase.`);
          invalidStock.statusCode = 409;
          throw invalidStock;
        }
        const previousStock = Number.isSafeInteger(product.stock) && product.stock >= 0 ? product.stock : 0;
        const nextStock = previousStock + line.quantity;
        if (!Number.isSafeInteger(nextStock)) {
          const stockOverflow = new Error('Item stock exceeds the supported quantity.');
          stockOverflow.statusCode = 409;
          throw stockOverflow;
        }
        const updateResult = await productCollection.updateOne(
          { slug: line.slug, archived: { $ne: true }, ...stockMatch },
          { $set: { stock: nextStock, purchasePrice: line.unitCostPaise / 100, updatedAt: now } },
          { session },
        );
        if (!updateResult.matchedCount) {
          const concurrentUpdate = new Error('Item stock changed while saving. Refresh and retry the purchase.');
          concurrentUpdate.statusCode = 409;
          throw concurrentUpdate;
        }
        await database.collection('stock_movements').insertOne({
          requestId: `${requestId}:${line.slug}`,
          slug: line.slug,
          itemName: line.name,
          type: 'purchase',
          quantity: line.quantity,
          previousStock,
          newStock: nextStock,
          reason: `Purchase ${purchaseNumber} · supplier bill ${billNumber}`,
          createdBy: req.user._id.toString(),
          createdByEmail: req.user.email,
          createdAt: now,
        }, { session });
      }
    });
    res.status(201).json(serializePurchase(savedPurchase));
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'This purchase request or bill number has already been recorded.' });
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  } finally {
    await session.endSession();
  }
});

app.get('/api/admin/sales/catalog', requireAdmin, async (req, res, next) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    const filter = { archived: { $ne: true }, available: true, stock: { $gt: 0 } };
    if (query) {
      const pattern = escapeRegExp(query);
      filter.$or = [
        { name: { $regex: pattern, $options: 'i' } },
        { slug: { $regex: pattern, $options: 'i' } },
        { sku: { $regex: pattern, $options: 'i' } },
        { barcode: { $regex: pattern, $options: 'i' } },
      ];
    }
    const items = await database.collection('products').find(filter, {
      projection: { _id: 0, slug: 1, name: 1, sku: 1, barcode: 1, unit: 1, price: 1, taxRate: 1, stock: 1 },
    }).sort({ name: 1 }).limit(50).toArray();
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/sales', requireAdmin, async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const dateFrom = typeof req.query.from === 'string' ? req.query.from : '';
    const dateTo = typeof req.query.to === 'string' ? req.query.to : '';
    const isValidDateOnly = value => {
      if (!value) return true;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const date = new Date(`${value}T00:00:00.000Z`);
      return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
    };
    if (!Number.isSafeInteger(page) || page < 1) return res.status(400).json({ error: 'Page number must be a positive integer.' });
    if (status && !['issued', 'partially-paid', 'paid'].includes(status)) return res.status(400).json({ error: 'Choose a valid invoice status.' });
    if (!isValidDateOnly(dateFrom) || !isValidDateOnly(dateTo)) {
      return res.status(400).json({ error: 'Enter invoice dates in YYYY-MM-DD format.' });
    }

    const filter = {};
    if (status) filter.status = status;
    if (dateFrom || dateTo) {
      const createdAt = {};
      if (dateFrom) createdAt.$gte = new Date(`${dateFrom}T00:00:00.000Z`);
      if (dateTo) {
        const nextDay = new Date(`${dateTo}T00:00:00.000Z`);
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
        createdAt.$lt = nextDay;
      }
      if (Number.isNaN(createdAt.$gte?.getTime()) || Number.isNaN(createdAt.$lt?.getTime()) ||
          (createdAt.$gte && createdAt.$lt && createdAt.$gte >= createdAt.$lt)) {
        return res.status(400).json({ error: 'Choose a valid invoice date range.' });
      }
      filter.createdAt = createdAt;
    }
    if (query) {
      const pattern = escapeRegExp(query);
      filter.$or = [
        { invoiceNumber: { $regex: pattern, $options: 'i' } },
        { 'customer.name': { $regex: pattern, $options: 'i' } },
        { 'customer.email': { $regex: pattern, $options: 'i' } },
        { 'customer.phone': { $regex: pattern, $options: 'i' } },
      ];
    }
    const pageSize = 25;
    const collection = database.collection('vyapaar_sales');
    const [total, sales] = await Promise.all([
      collection.countDocuments(filter),
      collection.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
    ]);
    res.json({ page, pageSize, total, items: sales.map(serializeSale) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/sales/:invoiceNumber', requireAdmin, async (req, res, next) => {
  try {
    const sale = await database.collection('vyapaar_sales').findOne({ invoiceNumber: req.params.invoiceNumber });
    if (!sale) return res.status(404).json({ error: 'Invoice not found.' });
    const payments = await database.collection('vyapaar_payments').find(
      { invoiceNumber: sale.invoiceNumber },
      { projection: { _id: 1, invoiceNumber: 1, amountPaise: 1, method: 1, reference: 1, createdByEmail: 1, createdAt: 1 } },
    ).sort({ createdAt: 1 }).toArray();
    res.json({ sale: serializeSale(sale), payments: payments.map(serializePayment) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/sales', requireAdmin, async (req, res, next) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const { customer, lines, requestId } = body;
  const invoiceDiscountPaise = amountToPaise(body.invoiceDiscount ?? 0);
  const initialPaymentPaise = amountToPaise(body.initialPayment ?? 0);
  const paymentMethod = body.paymentMethod;
  const customerName = typeof customer?.name === 'string' ? customer.name.trim() : '';
  const customerEmail = typeof customer?.email === 'string' ? customer.email.trim().toLowerCase() : '';
  const customerPhone = typeof customer?.phone === 'string' ? customer.phone.trim() : '';
  const customerAddress = typeof customer?.address === 'string' ? customer.address.trim() : '';
  const customerPartyId = typeof customer?.partyId === 'string' ? customer.partyId.trim() : '';

  if (typeof requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(requestId)) {
    return res.status(400).json({ error: 'The invoice request is invalid. Please submit again.' });
  }
  if (!customerName || customerName.length < 2 || customerName.length > 100 ||
      customerPartyId.length > 80 ||
      (customerPhone && !/^\d{10}$/.test(customerPhone)) ||
      (customerEmail && (customerEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail))) ||
      customerAddress.length > 500) {
    return res.status(400).json({ error: 'Enter a valid customer name, phone, email, and address.' });
  }
  if (!Array.isArray(lines) || lines.length < 1 || lines.length > 100 ||
      lines.some(line => !line || typeof line.slug !== 'string' ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(line.slug) ||
        !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 10000 ||
        amountToPaise(line.discount ?? 0) === null) ||
      new Set(lines.map(line => line?.slug)).size !== lines.length) {
    return res.status(400).json({ error: 'Add unique items with valid quantities and discounts.' });
  }
  if (invoiceDiscountPaise === null || initialPaymentPaise === null) {
    return res.status(400).json({ error: 'Discounts and payments must be non-negative amounts with up to two decimal places.' });
  }
  if (initialPaymentPaise > 0 && !['cash', 'upi', 'bank-transfer', 'card', 'other'].includes(paymentMethod)) {
    return res.status(400).json({ error: 'Choose a valid payment method.' });
  }

  const session = mongoClient.startSession();
  try {
    let savedSale;
    let wasDuplicate = false;
    await session.withTransaction(async () => {
      const sales = database.collection('vyapaar_sales');
      const existing = await sales.findOne({ requestId }, { session });
      if (existing) {
        savedSale = existing;
        wasDuplicate = true;
        return;
      }

      const productCollection = database.collection('products');
      let customerSnapshot = { name: customerName, email: customerEmail, phone: customerPhone, address: customerAddress };
      if (customerPartyId) {
        const party = await database.collection('vyapaar_parties').findOne(
          { id: customerPartyId, archived: { $ne: true }, type: { $in: ['customer', 'both'] } },
          { session },
        );
        if (!party) {
          const missingParty = new Error('Selected customer no longer exists. Choose another customer.');
          missingParty.statusCode = 409;
          throw missingParty;
        }
        customerSnapshot = { partyId: party.id, name: party.name, email: party.email || '', phone: party.phone || '', address: party.address || '', gstin: party.gstin || '' };
      }
      const saleLines = [];
      for (const inputLine of lines) {
        const product = await productCollection.findOne(
          { slug: inputLine.slug, archived: { $ne: true }, available: true },
          { session, projection: { slug: 1, name: 1, sku: 1, barcode: 1, unit: 1, price: 1, taxRate: 1, stock: 1 } },
        );
        if (!product) {
          const unavailable = new Error(`"${inputLine.slug}" is no longer available.`);
          unavailable.statusCode = 409;
          throw unavailable;
        }
        const unitPricePaise = amountToPaise(product.price);
        if (unitPricePaise === null || unitPricePaise <= 0) {
          const unpriced = new Error(`${product.name} does not have a valid selling price.`);
          unpriced.statusCode = 409;
          throw unpriced;
        }
        const taxRate = PRODUCT_TAX_RATES.includes(product.taxRate) ? product.taxRate : 0;
        const grossPaise = unitPricePaise * inputLine.quantity;
        const discountPaise = amountToPaise(inputLine.discount ?? 0);
        if (!Number.isSafeInteger(grossPaise) || discountPaise > grossPaise) {
          const invalidAmount = new Error(`The discount for ${product.name} exceeds its line amount.`);
          invalidAmount.statusCode = 400;
          throw invalidAmount;
        }
        saleLines.push({
          slug: product.slug,
          name: product.name,
          sku: product.sku || '',
          quantity: inputLine.quantity,
          unit: product.unit || 'piece',
          stockBefore: product.stock,
          unitPricePaise,
          taxRate,
          grossPaise,
          discountPaise,
        });
      }

      const subtotalPaise = saleLines.reduce((sum, line) => sum + line.grossPaise, 0);
      const lineDiscountPaise = saleLines.reduce((sum, line) => sum + line.discountPaise, 0);
      const preInvoiceDiscountPaise = subtotalPaise - lineDiscountPaise;
      if (!Number.isSafeInteger(subtotalPaise) || invoiceDiscountPaise > preInvoiceDiscountPaise) {
        const invalidDiscount = new Error('Invoice discount cannot exceed the remaining item total.');
        invalidDiscount.statusCode = 400;
        throw invalidDiscount;
      }

      let discountRemaining = invoiceDiscountPaise;
      const taxBasePaise = saleLines.reduce((sum, line) => sum + line.grossPaise - line.discountPaise, 0);
      const finalizedLines = saleLines.map((line, index) => {
        const lineBasePaise = line.grossPaise - line.discountPaise;
        const invoiceShare = index === saleLines.length - 1
          ? discountRemaining
          : taxBasePaise === 0 ? 0 : Number((BigInt(invoiceDiscountPaise) * BigInt(lineBasePaise)) / BigInt(taxBasePaise));
        discountRemaining -= invoiceShare;
        const taxablePaise = lineBasePaise - invoiceShare;
        const taxPaise = Number((BigInt(taxablePaise) * BigInt(line.taxRate) + 50n) / 100n);
        return { ...line, invoiceDiscountPaise: invoiceShare, taxPaise, totalPaise: taxablePaise + taxPaise };
      });
      const taxPaise = finalizedLines.reduce((sum, line) => sum + line.taxPaise, 0);
      const totalPaise = finalizedLines.reduce((sum, line) => sum + line.totalPaise, 0);
      if (!Number.isSafeInteger(totalPaise) || initialPaymentPaise > totalPaise) {
        const invalidPayment = new Error('The initial payment cannot exceed the invoice total.');
        invalidPayment.statusCode = 400;
        throw invalidPayment;
      }

      const now = new Date();
      const businessSettings = await database.collection('vyapaar_settings').findOne({ _id: 'business' }, { session });
      const invoicePrefix = businessSettings?.invoicePrefix || 'GH-INV';
      const invoiceNumber = `${invoicePrefix}-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
      const sale = {
        invoiceNumber,
        requestId,
        customer: customerSnapshot,
        business: {
          name: businessSettings?.businessName || "The Gifter's Hub",
          phone: businessSettings?.phone || '',
          email: businessSettings?.email || '',
          address: businessSettings?.address || '',
          gstin: businessSettings?.gstin || '',
          invoiceTerms: businessSettings?.invoiceTerms || '',
        },
        currency: 'INR',
        lines: finalizedLines,
        subtotalPaise,
        discountPaise: lineDiscountPaise + invoiceDiscountPaise,
        taxPaise,
        totalPaise,
        amountPaidPaise: initialPaymentPaise,
        balanceDuePaise: totalPaise - initialPaymentPaise,
        status: initialPaymentPaise === totalPaise ? 'paid' : initialPaymentPaise > 0 ? 'partially-paid' : 'issued',
        createdBy: req.user._id.toString(),
        createdByEmail: req.user.email,
        createdAt: now,
        updatedAt: now,
      };

      for (const line of finalizedLines) {
        const result = await productCollection.updateOne(
          { slug: line.slug, stock: { $gte: line.quantity }, archived: { $ne: true }, available: true },
          { $inc: { stock: -line.quantity } },
          { session },
        );
        if (!result.matchedCount) {
          const insufficientStock = new Error(`Not enough stock is available for ${line.name}. Refresh the catalogue and try again.`);
          insufficientStock.statusCode = 409;
          throw insufficientStock;
        }
        await database.collection('stock_movements').insertOne({
          requestId: `${requestId}:${line.slug}`,
          slug: line.slug,
          itemName: line.name,
          type: 'sale',
          mode: 'sale',
          quantity: -line.quantity,
          previousStock: line.stockBefore,
          newStock: line.stockBefore - line.quantity,
          reason: `Invoice ${invoiceNumber}`,
          referenceId: invoiceNumber,
          createdBy: req.user._id.toString(),
          createdByEmail: req.user.email,
          createdAt: now,
        }, { session });
      }

      await sales.insertOne(sale, { session });
      if (initialPaymentPaise > 0) {
        await database.collection('vyapaar_payments').insertOne({
          requestId: `${requestId}:initial`,
          invoiceNumber,
          amountPaise: initialPaymentPaise,
          method: paymentMethod,
          reference: '',
          createdBy: req.user._id.toString(),
          createdByEmail: req.user.email,
          createdAt: now,
        }, { session });
        await insertCashbookEntry({
          requestId: `sale-payment:${requestId}:initial`,
          accountId: typeof body.accountId === 'string' ? body.accountId : defaultCashAccountId(paymentMethod),
          amountPaise: initialPaymentPaise,
          direction: 'in',
          type: 'sale-payment',
          description: `Initial payment for ${invoiceNumber}`,
          actor: req.user,
          session,
        });
      }
      savedSale = sale;
    });
    res.status(wasDuplicate ? 200 : 201).json({ sale: serializeSale(savedSale) });
  } catch (error) {
    if (error.code === 11000) {
      const duplicate = await database.collection('vyapaar_sales').findOne({ requestId });
      if (duplicate) return res.json({ sale: serializeSale(duplicate) });
      return res.status(409).json({ error: 'An invoice with this identifier already exists. Please submit again.' });
    }
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  } finally {
    await session.endSession();
  }
});

app.post('/api/admin/sales/:invoiceNumber/payments', requireAdmin, async (req, res, next) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const amountPaise = amountToPaise(body.amount);
  const { requestId, method } = body;
  const reference = typeof body.reference === 'string' ? body.reference.trim() : '';
  if (amountPaise === null || amountPaise <= 0) return res.status(400).json({ error: 'Enter a payment amount greater than zero, with up to two decimal places.' });
  if (typeof requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(requestId)) return res.status(400).json({ error: 'The payment request is invalid. Please submit again.' });
  if (!['cash', 'upi', 'bank-transfer', 'card', 'other'].includes(method) || reference.length > 120) {
    return res.status(400).json({ error: 'Choose a valid payment method and reference.' });
  }

  const session = mongoClient.startSession();
  try {
    let resultSale;
    let wasDuplicate = false;
    await session.withTransaction(async () => {
      const payments = database.collection('vyapaar_payments');
      const previousPayment = await payments.findOne({ requestId }, { session });
      if (previousPayment) {
        const existingSale = await database.collection('vyapaar_sales').findOne({ invoiceNumber: previousPayment.invoiceNumber }, { session });
        if (previousPayment.invoiceNumber !== req.params.invoiceNumber || !existingSale) {
          const conflict = new Error('This payment request has already been used for another invoice.');
          conflict.statusCode = 409;
          throw conflict;
        }
        resultSale = existingSale;
        wasDuplicate = true;
        return;
      }

      const sales = database.collection('vyapaar_sales');
      const sale = await sales.findOne({ invoiceNumber: req.params.invoiceNumber }, { session });
      if (!sale) {
        const notFound = new Error('Invoice not found.');
        notFound.statusCode = 404;
        throw notFound;
      }
      if (amountPaise > sale.balanceDuePaise) {
        const overpayment = new Error('Payment cannot exceed the remaining invoice balance.');
        overpayment.statusCode = 400;
        throw overpayment;
      }
      const amountPaidPaise = sale.amountPaidPaise + amountPaise;
      const balanceDuePaise = sale.totalPaise - amountPaidPaise;
      const now = new Date();
      await payments.insertOne({
        requestId,
        invoiceNumber: sale.invoiceNumber,
        amountPaise,
        method,
        reference,
        createdBy: req.user._id.toString(),
        createdByEmail: req.user.email,
        createdAt: now,
      }, { session });
      await insertCashbookEntry({
        requestId: `sale-payment:${requestId}`,
        accountId: typeof body.accountId === 'string' ? body.accountId : defaultCashAccountId(method),
        amountPaise,
        direction: 'in',
        type: 'sale-payment',
        description: `Payment for ${sale.invoiceNumber}`,
        reference,
        actor: req.user,
        session,
      });
      const update = await sales.updateOne(
        { _id: sale._id, balanceDuePaise: sale.balanceDuePaise },
        {
          $set: {
            amountPaidPaise,
            balanceDuePaise,
            status: balanceDuePaise === 0 ? 'paid' : 'partially-paid',
            updatedAt: now,
          },
        },
        { session },
      );
      if (!update.matchedCount) {
        const conflict = new Error('Invoice balance changed while this payment was being saved. Please refresh and try again.');
        conflict.statusCode = 409;
        throw conflict;
      }
      resultSale = { ...sale, amountPaidPaise, balanceDuePaise, status: balanceDuePaise === 0 ? 'paid' : 'partially-paid', updatedAt: now };
    });
    res.status(wasDuplicate ? 200 : 201).json({ sale: serializeSale(resultSale) });
  } catch (error) {
    if (error.code === 11000) {
      const previousPayment = await database.collection('vyapaar_payments').findOne({ requestId });
      if (previousPayment?.invoiceNumber === req.params.invoiceNumber) {
        const existingSale = await database.collection('vyapaar_sales').findOne({ invoiceNumber: req.params.invoiceNumber });
        if (existingSale) return res.json({ sale: serializeSale(existingSale) });
      }
      return res.status(409).json({ error: 'This payment request has already been recorded.' });
    }
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  } finally {
    await session.endSession();
  }
});

app.get('/api/admin/vyapaar/accounts', requireAdmin, async (req, res, next) => {
  try {
    const [accounts, balances] = await Promise.all([
      database.collection('vyapaar_accounts').find({ archived: { $ne: true } }).sort({ type: 1, name: 1 }).toArray(),
      database.collection('vyapaar_cashbook').aggregate([
        { $group: { _id: '$accountId', balancePaise: { $sum: '$amountPaise' } } },
      ]).toArray(),
    ]);
    const balanceByAccount = new Map(balances.map(item => [item._id, item.balancePaise]));
    res.json({ items: accounts.map(({ _id, ...account }) => ({
      ...account,
      balancePaise: (account.openingBalancePaise || 0) + (balanceByAccount.get(account.id) || 0),
    })) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/vyapaar/accounts', requireAdmin, async (req, res, next) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const type = req.body?.type;
  const openingBalancePaise = amountToPaise(req.body?.openingBalance ?? 0);
  if (name.length < 2 || name.length > 80 || !['cash', 'bank'].includes(type) || openingBalancePaise === null) {
    return res.status(400).json({ error: 'Enter a valid account name, account type, and opening balance.' });
  }
  try {
    const account = {
      id: crypto.randomUUID(),
      name,
      type,
      openingBalancePaise,
      createdBy: req.user._id.toString(),
      createdByEmail: req.user.email,
      createdAt: new Date(),
    };
    await database.collection('vyapaar_accounts').insertOne(account);
    res.status(201).json({ ...account, balancePaise: openingBalancePaise });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'An account with that name already exists.' });
    next(error);
  }
});

app.get('/api/admin/vyapaar/cashbook', requireAdmin, async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    if (!Number.isSafeInteger(page) || page < 1) return res.status(400).json({ error: 'Page number must be a positive integer.' });
    const dateRange = parseDateRange(req.query);
    if (dateRange === null) return res.status(400).json({ error: 'Choose a valid date range.' });
    const filter = Object.keys(dateRange).length ? { createdAt: dateRange } : {};
    const pageSize = 50;
    const collection = database.collection('vyapaar_cashbook');
    const [total, items] = await Promise.all([
      collection.countDocuments(filter),
      collection.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
    ]);
    res.json({ page, pageSize, total, items });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/vyapaar/cashbook', requireAdmin, async (req, res, next) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const requestId = typeof body.requestId === 'string' ? body.requestId : '';
  const amountPaise = amountToPaise(body.amount);
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const reference = typeof body.reference === 'string' ? body.reference.trim() : '';
  if (!/^[a-f0-9-]{36}$/i.test(requestId) || amountPaise === null || amountPaise <= 0 ||
      description.length < 3 || description.length > 200 || reference.length > 120) {
    return res.status(400).json({ error: 'Enter a valid amount, description, optional reference, and request ID.' });
  }
  if (!['in', 'out', 'transfer'].includes(body.direction)) return res.status(400).json({ error: 'Choose money in, money out, or transfer.' });
  if (body.direction === 'transfer' && (!body.fromAccountId || !body.toAccountId || body.fromAccountId === body.toAccountId)) {
    return res.status(400).json({ error: 'Choose two different accounts for a transfer.' });
  }

  const session = mongoClient.startSession();
  try {
    let saved;
    await session.withTransaction(async () => {
      const ledger = database.collection('vyapaar_cashbook');
      const previous = await ledger.findOne({ requestId }, { session });
      if (previous) {
        saved = previous;
        return;
      }
      const now = new Date();
      if (body.direction === 'transfer') {
        const accounts = database.collection('vyapaar_accounts');
        const [from, to] = await Promise.all([
          accounts.findOne({ id: body.fromAccountId, archived: { $ne: true } }, { session }),
          accounts.findOne({ id: body.toAccountId, archived: { $ne: true } }, { session }),
        ]);
        if (!from || !to) {
          const invalidAccount = new Error('Choose two active cash or bank accounts.');
          invalidAccount.statusCode = 400;
          throw invalidAccount;
        }
        const pair = [
          { requestId, leg: 'out', accountId: from.id, accountName: from.name, amountPaise: -amountPaise },
          { requestId, leg: 'in', accountId: to.id, accountName: to.name, amountPaise },
        ].map(entry => ({
          ...entry,
          type: 'transfer',
          description,
          reference,
          createdBy: req.user._id.toString(),
          createdByEmail: req.user.email,
          createdAt: now,
        }));
        await ledger.insertMany(pair, { session });
        saved = pair[0];
      } else {
        await insertCashbookEntry({
          requestId,
          accountId: body.accountId,
          amountPaise,
          direction: body.direction,
          type: 'manual',
          description,
          reference,
          actor: req.user,
          session,
        });
        saved = await ledger.findOne({ requestId }, { session });
      }
    });
    res.status(201).json(saved);
  } catch (error) {
    if (error.code === 11000) {
      const previous = await database.collection('vyapaar_cashbook').findOne({ requestId });
      if (previous) return res.json(previous);
      return res.status(409).json({ error: 'This cashbook request has already been recorded.' });
    }
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  } finally {
    await session.endSession();
  }
});

app.get('/api/admin/vyapaar/expenses', requireAdmin, async (req, res, next) => {
  try {
    const dateRange = parseDateRange(req.query);
    if (dateRange === null) return res.status(400).json({ error: 'Choose a valid date range.' });
    const filter = Object.keys(dateRange).length ? { createdAt: dateRange } : {};
    const items = await database.collection('vyapaar_expenses').find(filter).sort({ createdAt: -1 }).limit(100).toArray();
    res.json({ items: items.map(({ _id, amountPaise, ...expense }) => ({ ...expense, amount: amountPaise / 100 })) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/vyapaar/expenses', requireAdmin, async (req, res, next) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const requestId = typeof body.requestId === 'string' ? body.requestId : '';
  const category = typeof body.category === 'string' ? body.category.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const amountPaise = amountToPaise(body.amount);
  const reference = typeof body.reference === 'string' ? body.reference.trim() : '';
  if (!/^[a-f0-9-]{36}$/i.test(requestId) || category.length < 2 || category.length > 60 ||
      description.length < 3 || description.length > 300 || amountPaise === null || amountPaise <= 0 ||
      reference.length > 120 || typeof body.accountId !== 'string') {
    return res.status(400).json({ error: 'Enter a valid category, description, positive amount, and active payment account.' });
  }
  const session = mongoClient.startSession();
  try {
    let expense;
    await session.withTransaction(async () => {
      const expenses = database.collection('vyapaar_expenses');
      const existing = await expenses.findOne({ requestId }, { session });
      if (existing) { expense = existing; return; }
      expense = {
        requestId,
        category,
        description,
        amountPaise,
        accountId: body.accountId,
        reference,
        createdBy: req.user._id.toString(),
        createdByEmail: req.user.email,
        createdAt: new Date(),
      };
      await expenses.insertOne(expense, { session });
      await insertCashbookEntry({
        requestId: `expense:${requestId}`,
        accountId: body.accountId,
        amountPaise,
        direction: 'out',
        type: 'expense',
        description: `${category}: ${description}`,
        reference,
        actor: req.user,
        session,
      });
    });
    res.status(201).json({ ...expense, amount: expense.amountPaise / 100 });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'This expense request has already been recorded.' });
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  } finally {
    await session.endSession();
  }
});

app.get('/api/admin/vyapaar/returns', requireAdmin, async (req, res, next) => {
  try {
    if (req.query.kind !== undefined || req.query.sourceNumber !== undefined) {
      const kind = req.query.kind;
      const sourceNumber = typeof req.query.sourceNumber === 'string' ? req.query.sourceNumber.trim() : '';
      if (!['sale', 'purchase'].includes(kind) || !sourceNumber || sourceNumber.length > 100) {
        return res.status(400).json({ error: 'Choose a valid return type and source transaction.' });
      }
      const numberField = kind === 'sale' ? 'invoiceNumber' : 'purchaseNumber';
      const quantities = await database.collection(kind === 'sale' ? 'vyapaar_sales_returns' : 'vyapaar_purchase_returns')
        .aggregate([
          { $match: { [numberField]: sourceNumber } },
          { $unwind: '$lines' },
          { $group: { _id: '$lines.slug', quantity: { $sum: '$lines.quantity' } } },
        ]).toArray();
      return res.json({ quantities: Object.fromEntries(quantities.map(item => [item._id, item.quantity])) });
    }
    const [sales, purchases] = await Promise.all([
      database.collection('vyapaar_sales_returns').find({}).sort({ createdAt: -1 }).limit(100).toArray(),
      database.collection('vyapaar_purchase_returns').find({}).sort({ createdAt: -1 }).limit(100).toArray(),
    ]);
    res.json({
      sales: sales.map(({ _id, creditPaise, refundPaise, ...item }) => ({ ...item, credit: creditPaise / 100, refund: refundPaise / 100 })),
      purchases: purchases.map(({ _id, creditPaise, ...item }) => ({ ...item, credit: creditPaise / 100 })),
    });
  } catch (error) {
    next(error);
  }
});

async function recordVyapaarReturn({ kind, req, res, next }) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const requestId = typeof body.requestId === 'string' ? body.requestId : '';
  const reference = typeof body.reference === 'string' ? body.reference.trim() : '';
  const isSaleReturn = kind === 'sale';
  const numberField = isSaleReturn ? 'invoiceNumber' : 'purchaseNumber';
  const sourceNumber = typeof body[numberField] === 'string' ? body[numberField].trim() : '';
  const collectionName = isSaleReturn ? 'vyapaar_sales_returns' : 'vyapaar_purchase_returns';
  if (!/^[a-f0-9-]{36}$/i.test(requestId) || !sourceNumber || sourceNumber.length > 100 ||
      reference.length > 300 || !Array.isArray(body.lines) || body.lines.length < 1 || body.lines.length > 100 ||
      body.lines.some(line => !line || typeof line.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(line.slug) ||
        !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 10000) ||
      new Set(body.lines.map(line => line.slug)).size !== body.lines.length) {
    return res.status(400).json({ error: 'Choose a valid invoice or purchase and unique item quantities to return.' });
  }
  const refundPaise = isSaleReturn ? amountToPaise(body.refundAmount ?? 0) : 0;
  if (refundPaise === null) return res.status(400).json({ error: 'Enter a valid refund amount with up to two decimal places.' });
  const session = mongoClient.startSession();
  try {
    let saved;
    await session.withTransaction(async () => {
      const returns = database.collection(collectionName);
      const previousRequest = await returns.findOne({ requestId }, { session });
      if (previousRequest) {
        if (previousRequest[numberField] !== sourceNumber) {
          const conflict = new Error('This return request has already been used for another transaction.');
          conflict.statusCode = 409;
          throw conflict;
        }
        saved = previousRequest;
        return;
      }
      const sourceCollection = database.collection(isSaleReturn ? 'vyapaar_sales' : 'vyapaar_purchases');
      const source = await sourceCollection.findOne({ [numberField]: sourceNumber }, { session });
      if (!source) {
        const missing = new Error(isSaleReturn ? 'Invoice not found.' : 'Purchase not found.');
        missing.statusCode = 404;
        throw missing;
      }
      const sourceLock = await sourceCollection.updateOne({ _id: source._id }, { $inc: { returnCount: 1 } }, { session });
      if (!sourceLock.matchedCount) {
        const conflict = new Error('The source transaction changed. Refresh and try again.');
        conflict.statusCode = 409;
        throw conflict;
      }
      if (isSaleReturn && source.balanceDuePaise > 0) {
        const unpaid = new Error('Settle the invoice balance before recording a refund or return credit.');
        unpaid.statusCode = 409;
        throw unpaid;
      }
      const recordedReturns = await returns.find({ [numberField]: sourceNumber }, { session }).toArray();
      const previouslyReturned = new Map();
      const previouslyCreditedByLine = new Map();
      let previousCredits = 0;
      let previousRefunds = 0;
      for (const item of recordedReturns) {
        previousCredits += item.creditPaise;
        previousRefunds += item.refundPaise || 0;
        for (const line of item.lines) {
          previouslyReturned.set(line.slug, (previouslyReturned.get(line.slug) || 0) + line.quantity);
          previouslyCreditedByLine.set(line.slug, (previouslyCreditedByLine.get(line.slug) || 0) + line.creditPaise);
        }
      }
      const returnedLines = [];
      let creditPaise = 0;
      for (const requested of body.lines) {
        const original = source.lines.find(line => line.slug === requested.slug);
        const alreadyReturned = previouslyReturned.get(requested.slug) || 0;
        if (!original || alreadyReturned + requested.quantity > original.quantity) {
          const invalidQuantity = new Error(`Return quantity for ${requested.slug} exceeds the unreturned quantity.`);
          invalidQuantity.statusCode = 400;
          throw invalidQuantity;
        }
        const cumulativeQuantity = alreadyReturned + requested.quantity;
        const cumulativeCredit = cumulativeQuantity === original.quantity
          ? original.totalPaise
          : Math.floor(original.totalPaise * cumulativeQuantity / original.quantity);
        const lineCredit = cumulativeCredit - (previouslyCreditedByLine.get(requested.slug) || 0);
        if (!Number.isSafeInteger(lineCredit)) {
          const invalidCredit = new Error('Return credit exceeds the supported amount.');
          invalidCredit.statusCode = 400;
          throw invalidCredit;
        }
        creditPaise += lineCredit;
        returnedLines.push({ slug: original.slug, name: original.name, quantity: requested.quantity, unit: original.unit || 'piece', creditPaise: lineCredit });
      }
      if (!Number.isSafeInteger(creditPaise) || creditPaise <= 0 || previousCredits + creditPaise > source.totalPaise) {
        const creditConflict = new Error('Return credit exceeds the remaining source transaction amount.');
        creditConflict.statusCode = 400;
        throw creditConflict;
      }
      if (isSaleReturn && refundPaise > Math.min(creditPaise, source.amountPaidPaise - previousRefunds)) {
        const overRefund = new Error('Refund cannot exceed this return credit or the amount paid on the invoice.');
        overRefund.statusCode = 400;
        throw overRefund;
      }
      const now = new Date();
      const savedReturn = {
        requestId,
        [numberField]: sourceNumber,
        sourceId: source._id,
        partyName: isSaleReturn ? source.customer.name : source.supplierName,
        reference,
        lines: returnedLines,
        creditPaise,
        refundPaise,
        createdBy: req.user._id.toString(),
        createdByEmail: req.user.email,
        createdAt: now,
      };
      const productsCollection = database.collection('products');
      for (const line of returnedLines) {
        const product = await productsCollection.findOne({ slug: line.slug }, { session, projection: { stock: 1 } });
        if (!product || (!isSaleReturn && (!Number.isSafeInteger(product.stock) || product.stock < line.quantity))) {
          const stockConflict = new Error(isSaleReturn ? `Item ${line.name} is no longer available.` : `Not enough stock is available to dispatch ${line.name}.`);
          stockConflict.statusCode = 409;
          throw stockConflict;
        }
        const previousStock = Number.isSafeInteger(product.stock) && product.stock >= 0 ? product.stock : 0;
        const nextStock = previousStock + (isSaleReturn ? line.quantity : -line.quantity);
        const stockFilter = product.stock === undefined ? { stock: { $exists: false } } : { stock: product.stock };
        const update = await productsCollection.updateOne({ slug: line.slug, ...stockFilter }, { $set: { stock: nextStock, updatedAt: now } }, { session });
        if (!update.matchedCount) {
          const stockConflict = new Error(`Stock for ${line.name} changed while recording the return. Refresh and try again.`);
          stockConflict.statusCode = 409;
          throw stockConflict;
        }
        await database.collection('stock_movements').insertOne({
          requestId: `${requestId}:${line.slug}`,
          slug: line.slug,
          itemName: line.name,
          type: isSaleReturn ? 'sale-return' : 'purchase-return',
          quantity: nextStock - previousStock,
          previousStock,
          newStock: nextStock,
          reason: `${isSaleReturn ? 'Sales return' : 'Purchase return'} ${sourceNumber}${reference ? ` · ${reference}` : ''}`,
          referenceId: sourceNumber,
          createdBy: req.user._id.toString(),
          createdByEmail: req.user.email,
          createdAt: now,
        }, { session });
      }
      await returns.insertOne(savedReturn, { session });
      if (!isSaleReturn) {
        const supplierCreditPaise = previousCredits + creditPaise;
        const originalBalancePaise = Math.max(0, source.totalPaise - source.amountPaidPaise);
        const balanceDuePaise = Math.max(0, originalBalancePaise - supplierCreditPaise);
        await sourceCollection.updateOne({ _id: source._id }, {
          $set: {
            supplierCreditPaise,
            supplierRefundDuePaise: Math.max(0, supplierCreditPaise - originalBalancePaise),
            balanceDuePaise,
            status: balanceDuePaise === 0 ? 'paid' : source.status,
            updatedAt: now,
          },
        }, { session });
      }
      if (isSaleReturn && refundPaise > 0) {
        await insertCashbookEntry({
          requestId: `sales-return:${requestId}`,
          accountId: typeof body.accountId === 'string' ? body.accountId : 'cash-default',
          amountPaise: refundPaise,
          direction: 'out',
          type: 'sales-return-refund',
          description: `Refund for ${sourceNumber}`,
          reference,
          actor: req.user,
          session,
        });
      }
      saved = savedReturn;
    });
    res.status(201).json({ ...saved, credit: saved.creditPaise / 100, refund: (saved.refundPaise || 0) / 100 });
  } catch (error) {
    if (error.code === 11000) {
      const existing = await database.collection(collectionName).findOne({ requestId });
      if (existing) return res.json({ ...existing, credit: existing.creditPaise / 100, refund: (existing.refundPaise || 0) / 100 });
      return res.status(409).json({ error: 'This return request has already been recorded.' });
    }
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  } finally {
    await session.endSession();
  }
}

app.post('/api/admin/vyapaar/returns/sales', requireAdmin, (req, res, next) => recordVyapaarReturn({ kind: 'sale', req, res, next }));
app.post('/api/admin/vyapaar/returns/purchases', requireAdmin, (req, res, next) => recordVyapaarReturn({ kind: 'purchase', req, res, next }));

app.get('/api/admin/vyapaar/reports', requireAdmin, async (req, res, next) => {
  try {
    const range = parseDateRange(req.query);
    if (range === null) return res.status(400).json({ error: 'Choose a valid date range.' });
    const match = Object.keys(range).length ? { createdAt: range } : {};
    const summarize = async (collectionName, amountField) => {
      const result = await database.collection(collectionName).aggregate([
        { $match: match },
        { $group: { _id: null, count: { $sum: 1 }, amountPaise: { $sum: { $ifNull: [`$${amountField}`, 0] } } } },
      ]).toArray();
      return { count: result[0]?.count || 0, amount: (result[0]?.amountPaise || 0) / 100 };
    };
    const [sales, purchases, salesReturns, purchaseReturns, expenses, accounts, stock] = await Promise.all([
      summarize('vyapaar_sales', 'totalPaise'),
      summarize('vyapaar_purchases', 'totalPaise'),
      summarize('vyapaar_sales_returns', 'creditPaise'),
      summarize('vyapaar_purchase_returns', 'creditPaise'),
      summarize('vyapaar_expenses', 'amountPaise'),
      database.collection('vyapaar_accounts').find({ archived: { $ne: true } }).toArray(),
      database.collection('products').aggregate([
        { $match: { archived: { $ne: true } } },
        { $group: { _id: null, units: { $sum: { $ifNull: ['$stock', 0] } }, items: { $sum: 1 } } },
      ]).toArray(),
    ]);
    const ledger = await database.collection('vyapaar_cashbook').aggregate([
      ...(Object.keys(range).length ? [{ $match: { createdAt: range } }] : []),
      { $group: { _id: null, inflowPaise: { $sum: { $cond: [{ $gt: ['$amountPaise', 0] }, '$amountPaise', 0] } }, outflowPaise: { $sum: { $cond: [{ $lt: ['$amountPaise', 0] }, { $abs: '$amountPaise' }, 0] } } } },
    ]).toArray();
    const accountBalances = await database.collection('vyapaar_cashbook').aggregate([
      { $group: { _id: '$accountId', amountPaise: { $sum: '$amountPaise' } } },
    ]).toArray();
    const balanceByAccount = new Map(accountBalances.map(account => [account._id, account.amountPaise]));
    res.json({
      range: { from: req.query.from || '', to: req.query.to || '' },
      sales, purchases, salesReturns, purchaseReturns, expenses,
      cashbook: {
        inflow: (ledger[0]?.inflowPaise || 0) / 100,
        outflow: (ledger[0]?.outflowPaise || 0) / 100,
        net: ((ledger[0]?.inflowPaise || 0) - (ledger[0]?.outflowPaise || 0)) / 100,
      },
      inventory: { items: stock[0]?.items || 0, units: stock[0]?.units || 0 },
      accounts: accounts.map(({ _id, ...account }) => ({
        ...account,
        balancePaise: (account.openingBalancePaise || 0) + (balanceByAccount.get(account.id) || 0),
      })),
      disclaimer: 'Operational summary only; not accounting, tax, GST, or statutory reporting. Cashbook covers entries recorded since this module was introduced.',
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/vyapaar/activity', requireAdmin, async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    if (!Number.isSafeInteger(page) || page < 1) return res.status(400).json({ error: 'Page number must be a positive integer.' });
    const pageSize = 50;
    const collection = database.collection('vyapaar_activity');
    const [total, items] = await Promise.all([
      collection.countDocuments(),
      collection.find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
    ]);
    res.json({ page, pageSize, total, items });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/admin/orders/:orderId', requireAdmin, async (req, res, next) => {
  try {
    const { status, paymentStatus } = req.body;
    const orderStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    const paymentStatuses = ['pending', 'paid', 'failed', 'refunded'];
    const changes = {};
    if (status !== undefined) {
      if (!orderStatuses.includes(status)) return res.status(400).json({ error: 'Choose a valid order status.' });
      changes.status = status;
    }
    if (paymentStatus !== undefined) {
      if (!paymentStatuses.includes(paymentStatus)) return res.status(400).json({ error: 'Choose a valid payment status.' });
      changes.paymentStatus = paymentStatus;
    }
    if (!Object.keys(changes).length) return res.status(400).json({ error: 'Provide an order or payment status to update.' });

    const orders = database.collection('orders');
    const previousOrder = await orders.findOne(
      { orderId: req.params.orderId },
      { projection: { status: 1, paymentStatus: 1 } },
    );
    if (!previousOrder) return res.status(404).json({ error: 'Order not found.' });
    const result = await orders.updateOne({ orderId: req.params.orderId }, { $set: changes });
    if (!result.matchedCount) return res.status(404).json({ error: 'Order not found.' });
    const order = await orders.findOne({ orderId: req.params.orderId });
    if (previousOrder.status !== order.status || previousOrder.paymentStatus !== order.paymentStatus) {
      try {
        await sendOrderUpdateEmail(
          order,
          `Update for order ${order.orderId}`,
          'There is an update on your order.',
        );
      } catch (deliveryError) {
        console.error(`Order update email failed for ${order.orderId}:`, deliveryError.message);
      }
    }
    res.json({
      id: order._id.toString(),
      orderId: order.orderId,
      status: order.status || 'pending',
      paymentStatus: order.paymentStatus || 'pending',
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/pincode/:pin', async (req, res) => {
  if (!/^[1-9]\d{5}$/.test(req.params.pin)) return res.status(400).json({ ok: false, message: 'Enter a valid 6-digit pincode' });
  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${req.params.pin}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return res.status(502).json({ ok: false, message: 'Pincode lookup is temporarily unavailable. Please enter the location manually.' });
    }
    const result = await response.json();
    const office = result?.[0]?.Status === 'Success' ? result[0].PostOffice?.[0] : null;
    if (!office || !office.Name || !office.State || !office.Country) {
      return res.status(404).json({ ok: false, message: 'We could not find this pincode. Please check it or enter the location manually.' });
    }
    const days = req.params.pin.startsWith('14') ? 2 : 4;
    const date = new Date();
    date.setDate(date.getDate() + days);
    return res.json({
      ok: true,
      eta: date.toDateString().slice(0, 10),
      cod: true,
      location: {
        locality: office.Name,
        city: office.District || office.Block || office.Region || '',
        state: office.State,
        country: office.Country,
      },
    });
  } catch (error) {
    console.error('Pincode lookup failed:', error.message);
    const timedOut = error.name === 'TimeoutError' || error.name === 'AbortError';
    return res.status(timedOut ? 504 : 502).json({
      ok: false,
      message: 'Pincode lookup is temporarily unavailable. Please enter the location manually.',
    });
  }
});

app.post('/api/cart/price', async (req, res, next) => {
  try {
    const items = req.body.items || [];
    if (!Array.isArray(items) || items.length > 30 ||
        items.some(item => !item || typeof item.slug !== 'string' || !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99 ||
          (item.variant !== undefined && (typeof item.variant !== 'string' || item.variant.length > 120)))) {
      return res.status(400).json({ error: 'Cart items are invalid.' });
    }
    const catalog = await getProducts();
    const pricedItems = items.every(item => catalog.some(product =>
      product.slug === item.slug && product.available !== false &&
      Number.isFinite(product.price) && product.price > 0));
    if (!pricedItems) return res.status(409).json({ error: 'One or more products are not available for purchase yet.' });
    res.json(price(items, req.body.coupon, !!req.body.gift, catalog));
  } catch (error) {
    next(error);
  }
});

app.post('/api/orders', requireUser, async (req, res, next) => {
  try {
    const { items, coupon, gift, customer } = req.body;
    const giftMessage = typeof req.body.giftMessage === 'string' ? req.body.giftMessage.trim() : '';
    if (!validItems(items) || !customer || typeof customer.name !== 'string' ||
        !customer.name.trim() || !/^\d{10}$/.test(customer.phone || '') ||
        !/^[1-9]\d{5}$/.test(customer.pincode || '') ||
        typeof customer.address !== 'string' || customer.address.trim().length < 8 ||
        giftMessage.length > 500) {
      return res.status(400).json({ error: 'Enter valid delivery details and cart items.' });
    }

    const total = price(items, coupon, !!gift, await getProducts());
    if (!total.lines.length || total.lines.length !== items.length) {
      return res.status(400).json({ error: 'One or more cart products are no longer available.' });
    }
    const order = {
      orderId: `GH${crypto.randomBytes(5).toString('hex').toUpperCase()}`,
      userId: req.user._id,
      couponCode: total.couponOk && typeof coupon === 'string' ? coupon.trim().toUpperCase() : '',
      customer: {
        name: customer.name.trim(),
        phone: customer.phone,
        pincode: customer.pincode,
        address: customer.address.trim(),
      },
      email: req.user.email,
      giftMessage,
      status: 'pending',
      paymentMethod: 'cash-on-delivery',
      paymentStatus: 'pending',
      ...total,
      createdAt: new Date(),
    };
    await database.collection('orders').insertOne(order);
    try {
      await database.collection('users').updateOne(
        { _id: req.user._id },
        { $set: { cartItems: [], updatedAt: new Date() } },
      );
    } catch (cartError) {
      console.error(`Could not clear saved cart after order ${order.orderId}:`, cartError.message);
    }
    try {
      await sendOrderUpdateEmail(order, `Order ${order.orderId} confirmed`, 'We received your order.');
    } catch (deliveryError) {
      console.error(`Order confirmation email failed for ${order.orderId}:`, deliveryError.message);
    }
    res.status(201).json({ id: order.orderId, total: order.total });
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  console.error('Request failed:', error.message);
  if (res.headersSent) return next(error);
  if (error.name === 'MongoServerSelectionError' || error.name === 'MongoNetworkError') {
    return res.status(503).json({ error: 'The database is temporarily unavailable. Please try again.' });
  }
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

async function start() {
  if (mongoClient) {
    await mongoClient.connect();
    database = mongoClient.db(DATABASE_NAME);
    await Promise.all([
      database.collection('users').createIndex({ email: 1 }, { unique: true }),
      database.collection('users').createIndex({ firebaseUid: 1 }, { unique: true, sparse: true }),
      database.collection('sessions').createIndex({ tokenHash: 1 }, { unique: true }),
      database.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      database.collection('password_reset_codes').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      database.collection('pending_registrations').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      database.collection('gift_reminders').createIndex({ userId: 1, date: 1 }),
      database.collection('orders').createIndex({ orderId: 1 }, { unique: true }),
      database.collection('orders').createIndex({ userId: 1, createdAt: -1 }),
      database.collection('products').createIndex({ slug: 1 }, { unique: true }),
      database.collection('products').createIndex({ sku: 1 }, { unique: true, partialFilterExpression: { sku: { $type: 'string' } } }),
      database.collection('products').createIndex({ barcode: 1 }, { unique: true, partialFilterExpression: { barcode: { $type: 'string' } } }),
      database.collection('vyapaar_categories').createIndex({ slug: 1 }, { unique: true }),
      database.collection('vyapaar_units').createIndex({ name: 1 }, { unique: true }),
      database.collection('vyapaar_parties').createIndex({ id: 1 }, { unique: true }),
      database.collection('vyapaar_purchases').createIndex({ requestId: 1 }, { unique: true }),
      database.collection('vyapaar_purchases').createIndex({ supplierId: 1, billNumber: 1 }, { unique: true }),
      database.collection('stock_movements').createIndex({ requestId: 1 }, { unique: true }),
      database.collection('stock_movements').createIndex({ slug: 1, createdAt: -1 }),
      database.collection('vyapaar_sales').createIndex({ invoiceNumber: 1 }, { unique: true }),
      database.collection('vyapaar_sales').createIndex({ requestId: 1 }, { unique: true }),
      database.collection('vyapaar_sales').createIndex({ createdAt: -1 }),
      database.collection('vyapaar_payments').createIndex({ requestId: 1 }, { unique: true }),
      database.collection('vyapaar_payments').createIndex({ invoiceNumber: 1, createdAt: 1 }),
      database.collection('vyapaar_accounts').createIndex({ id: 1 }, { unique: true }),
      database.collection('vyapaar_accounts').createIndex({ name: 1 }, { unique: true }),
      database.collection('vyapaar_cashbook').createIndex({ requestId: 1, leg: 1 }, { unique: true }),
      database.collection('vyapaar_cashbook').createIndex({ accountId: 1, createdAt: -1 }),
      database.collection('vyapaar_expenses').createIndex({ requestId: 1 }, { unique: true }),
      database.collection('vyapaar_expenses').createIndex({ createdAt: -1 }),
      database.collection('vyapaar_sales_returns').createIndex({ requestId: 1 }, { unique: true }),
      database.collection('vyapaar_sales_returns').createIndex({ invoiceNumber: 1, createdAt: -1 }),
      database.collection('vyapaar_purchase_returns').createIndex({ requestId: 1 }, { unique: true }),
      database.collection('vyapaar_purchase_returns').createIndex({ purchaseNumber: 1, createdAt: -1 }),
      database.collection('vyapaar_activity').createIndex({ createdAt: -1 }),
    ]);
    await database.collection('products').bulkWrite(products.map(product => ({
      updateOne: { filter: { slug: product.slug }, update: { $setOnInsert: product }, upsert: true },
    })));
    await database.collection('vyapaar_categories').bulkWrite(PRODUCT_CATEGORIES.map(slug => ({
      updateOne: {
        filter: { slug },
        update: { $setOnInsert: { slug, name: slug.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join(' '), archived: false, createdAt: new Date(), updatedAt: new Date() } },
        upsert: true,
      },
    })));
    await database.collection('vyapaar_units').bulkWrite(['piece', 'pcs', 'unit', 'set', 'pair', 'box'].map(name => ({
      updateOne: { filter: { name }, update: { $setOnInsert: { name, archived: false, createdAt: new Date(), updatedAt: new Date() } }, upsert: true },
    })));
    await database.collection('vyapaar_accounts').bulkWrite([
      { id: 'cash-default', name: 'Cash', type: 'cash' },
      { id: 'bank-default', name: 'Bank / UPI', type: 'bank' },
    ].map(account => ({
      updateOne: {
        filter: { id: account.id },
        update: { $setOnInsert: { ...account, openingBalancePaise: 0, createdAt: new Date() } },
        upsert: true,
      },
    })));
    await seedAdminUser();
    console.log(`Connected to MongoDB database "${DATABASE_NAME}" and synchronized ${products.length} products.`);
    runGiftReminderSweep().catch(error => console.error('Gift reminder scan failed:', error.message));
    setInterval(() => {
      runGiftReminderSweep().catch(error => console.error('Gift reminder scan failed:', error.message));
    }, 6 * 60 * 60 * 1000).unref();
  } else {
    console.warn('MONGODB_URI is not set. Authentication, persistent products, and orders are unavailable.');
  }

  app.listen(PORT, HOST, () => console.log(`API on http://${HOST}:${PORT}`));
}

start().catch(error => {
  console.error('Unable to initialize MongoDB:', error.message);
  process.exitCode = 1;
});
