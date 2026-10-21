require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const { MongoClient } = require('mongodb');
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
const firebaseAuth = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  ? getAuth(getApps().find(app => app.name === 'gifter-hub-auth') || initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)),
    projectId: process.env.FIREBASE_PROJECT_ID || undefined,
  }, 'gifter-hub-auth'))
  : null;

app.use(cors());
app.use(express.json({ limit: '32kb' }));
app.use('/api/auth', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please try again in 15 minutes.' },
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

async function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = await scrypt(password, salt, 64);
  return { salt, hash: hash.toString('hex') };
}

async function passwordMatches(password, salt, expectedHash) {
  const actual = await scrypt(password, salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
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
  return database.collection('products').find({}, { projection: { _id: 0 } }).toArray();
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
      Number.isInteger(item.qty) && item.qty > 0 && item.qty <= 99);
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

app.post('/api/auth/register', authLimiter, dbRequired, async (req, res, next) => {
  try {
    const suppliedName = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const name = suppliedName || 'Customer';
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;
    if (suppliedName && (suppliedName.length < 2 || suppliedName.length > 100)) {
      return res.status(400).json({ error: 'Name must be between 2 and 100 characters.' });
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (typeof password !== 'string' || password.length < 10 || password.length > 128) {
      return res.status(400).json({ error: 'Use a password between 10 and 128 characters.' });
    }

    const credentials = await hashPassword(password);
    const user = {
      name,
      email,
      role: 'customer',
      passwordSalt: credentials.salt,
      passwordHash: credentials.hash,
      createdAt: new Date(),
    };
    try {
      const result = await database.collection('users').insertOne(user);
      user._id = result.insertedId;
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({ error: 'An account with this email already exists. Sign in instead.' });
      throw error;
    }

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
      identity = await firebaseAuth.verifyIdToken(req.body.idToken, true);
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

app.get('/api/admin/overview', requireAdmin, async (req, res, next) => {
  try {
    const usersPage = Number(req.query.usersPage || 1);
    const ordersPage = Number(req.query.ordersPage || 1);
    if (!Number.isSafeInteger(usersPage) || usersPage < 1 ||
        !Number.isSafeInteger(ordersPage) || ordersPage < 1) {
      return res.status(400).json({ error: 'Page numbers must be positive integers.' });
    }

    const pageSize = 25;
    const userCollection = database.collection('users');
    const orderCollection = database.collection('orders');
    const [userCount, orderCount, totals, users, orders] = await Promise.all([
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
      orderCollection.find({})
        .sort({ createdAt: -1 }).skip((ordersPage - 1) * pageSize).limit(pageSize).toArray(),
    ]);

    res.json({
      summary: {
        userCount,
        orderCount,
        orderValue: totals[0]?.orderValue || 0,
        pendingPayments: totals[0]?.pendingPayments || 0,
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
        total: orderCount,
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
    const result = await orders.updateOne({ orderId: req.params.orderId }, { $set: changes });
    if (!result.matchedCount) return res.status(404).json({ error: 'Order not found.' });
    const order = await orders.findOne({ orderId: req.params.orderId });
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

app.get('/api/pincode/:pin', (req, res) => {
  if (!/^[1-9]\d{5}$/.test(req.params.pin)) return res.status(400).json({ ok: false, message: 'Enter a valid 6-digit pincode' });
  const days = req.params.pin.startsWith('14') ? 2 : 4;
  const date = new Date();
  date.setDate(date.getDate() + days);
  res.json({ ok: true, eta: date.toDateString().slice(0, 10), cod: true });
});

app.post('/api/cart/price', async (req, res, next) => {
  try {
    const items = req.body.items || [];
    if (!Array.isArray(items) || items.length > 30 ||
        items.some(item => !item || typeof item.slug !== 'string' || !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99)) {
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
    const productSlugs = products.map(product => product.slug);
    await database.collection('products').deleteMany({ slug: { $nin: productSlugs } });
    await Promise.all([
      database.collection('users').createIndex({ email: 1 }, { unique: true }),
      database.collection('users').createIndex({ firebaseUid: 1 }, { unique: true, sparse: true }),
      database.collection('sessions').createIndex({ tokenHash: 1 }, { unique: true }),
      database.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      database.collection('orders').createIndex({ orderId: 1 }, { unique: true }),
      database.collection('orders').createIndex({ userId: 1, createdAt: -1 }),
      database.collection('products').createIndex({ slug: 1 }, { unique: true }),
    ]);
    await database.collection('products').bulkWrite(products.map(product => ({
      replaceOne: { filter: { slug: product.slug }, replacement: product, upsert: true },
    })));
    await seedAdminUser();
    console.log(`Connected to MongoDB database "${DATABASE_NAME}" and synchronized ${products.length} products.`);
  } else {
    console.warn('MONGODB_URI is not set. Authentication, persistent products, and orders are unavailable.');
  }

  app.listen(PORT, HOST, () => console.log(`API on http://${HOST}:${PORT}`));
}

start().catch(error => {
  console.error('Unable to initialize MongoDB:', error.message);
  process.exitCode = 1;
});
