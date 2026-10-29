const crypto = require('crypto');

module.exports = function createAccountRouter(express, services) {
  const {
    ObjectId,
    requireUser,
    validCartItems,
    mergeCartItems,
    cartItemsForClient,
    getProducts,
    getDatabase,
    SESSION_COOKIE,
    readCookie,
    hashToken,
    passwordMatches,
    firebaseAuth,
    firebaseServiceAccount,
    mongoClient,
    sessionCookieOptions,
  } = services;
  const router = express.Router();

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

  router.get('/profile', requireUser, async (req, res, next) => {
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

  router.put('/profile', requireUser, async (req, res, next) => {
    try {
      const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
      const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
      if (name.length < 2 || name.length > 100) {
        return res.status(400).json({ error: 'Name must be between 2 and 100 characters.' });
      }
      if (phone && !/^\d{10}$/.test(phone)) {
        return res.status(400).json({ error: 'Enter a valid 10-digit mobile number.' });
      }
      await getDatabase().collection('users').updateOne(
        { _id: req.user._id },
        { $set: { name, phone, updatedAt: new Date() } },
      );
      res.json({ profile: { name, email: req.user.email, phone, hasPassword: Boolean(req.user.passwordHash), isAdmin: req.user.role === 'admin' } });
    } catch (error) {
      next(error);
    }
  });

  router.get('/addresses', requireUser, async (req, res, next) => {
    try {
      const user = await getDatabase().collection('users').findOne(
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

  router.post('/addresses', requireUser, async (req, res, next) => {
    try {
      const address = validateAddress(req.body);
      if (!address) return res.status(400).json({ error: 'Enter a valid address, contact name, mobile number, and pincode.' });
      address.id = crypto.randomUUID();
      const result = await getDatabase().collection('users').updateOne(
        {
          _id: req.user._id,
          $expr: { $lt: [{ $size: { $ifNull: ['$addresses', []] } }, 10] },
        },
        { $push: { addresses: address }, $set: { updatedAt: new Date() } },
      );
      if (!result.matchedCount) return res.status(409).json({ error: 'You can save up to 10 addresses.' });
      await getDatabase().collection('users').updateOne(
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
      const user = await getDatabase().collection('users').findOne(
        { _id: req.user._id },
        { projection: { defaultAddressId: 1 } },
      );
      res.status(201).json({ address, defaultAddressId: user?.defaultAddressId || address.id });
    } catch (error) {
      next(error);
    }
  });

  router.put('/addresses/:addressId/default', requireUser, async (req, res, next) => {
    try {
      const result = await getDatabase().collection('users').updateOne(
        { _id: req.user._id, 'addresses.id': req.params.addressId },
        { $set: { defaultAddressId: req.params.addressId, updatedAt: new Date() } },
      );
      if (!result.matchedCount) return res.status(404).json({ error: 'That saved address could not be found.' });
      res.json({ defaultAddressId: req.params.addressId });
    } catch (error) {
      next(error);
    }
  });

  router.put('/addresses/:addressId', requireUser, async (req, res, next) => {
    try {
      const address = validateAddress(req.body);
      if (!address) return res.status(400).json({ error: 'Enter a valid address, contact name, mobile number, and pincode.' });
      const result = await getDatabase().collection('users').updateOne(
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

  router.delete('/addresses/:addressId', requireUser, async (req, res, next) => {
    try {
      const users = getDatabase().collection('users');
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

  router.get('/orders', requireUser, async (req, res, next) => {
    try {
      const orders = await getDatabase().collection('orders')
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

  router.get('/coupons', requireUser, async (req, res, next) => {
    try {
      const offers = await getDatabase().collection('coupons')
        .find({ status: 'active', eligibilityStatus: 'configured' }, { projection: { _id: 0, code: 1, value: 1, minimumSpendPaise: 1 } })
        .sort({ code: 1 })
        .toArray()
        .then(items => items.map(offer => ({
          code: offer.code,
          description: `Up to ${offer.value}% off`,
          minimumSpend: (offer.minimumSpendPaise || 0) / 100,
        })));
      const redemptions = await getDatabase().collection('orders')
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

  router.get('/shopping', requireUser, async (req, res, next) => {
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

  router.put('/shopping', requireUser, async (req, res, next) => {
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
      await getDatabase().collection('users').updateOne(
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

  router.post('/shopping/merge', requireUser, async (req, res, next) => {
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
      await getDatabase().collection('users').updateOne(
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

  router.get('/reminders', requireUser, async (req, res, next) => {
    try {
      const reminders = await getDatabase().collection('gift_reminders').find(
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

  router.post('/reminders', requireUser, async (req, res, next) => {
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
      const reminderCount = await getDatabase().collection('gift_reminders').countDocuments({ userId: req.user._id });
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
      await getDatabase().collection('gift_reminders').insertOne(reminder);
      res.status(201).json({
        reminder: { id: reminder._id, name, occasion, date, emailEnabled: true, createdAt: reminder.createdAt },
      });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/reminders/:reminderId', requireUser, async (req, res, next) => {
    try {
      const result = await getDatabase().collection('gift_reminders').deleteOne({
        _id: req.params.reminderId,
        userId: req.user._id,
      });
      if (!result.deletedCount) return res.status(404).json({ error: 'That reminder could not be found.' });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.get('/preferences', requireUser, async (req, res, next) => {
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

  router.put('/preferences', requireUser, async (req, res, next) => {
    try {
      if (typeof req.body.orderEmail !== 'boolean') {
        return res.status(400).json({ error: 'Choose whether to receive order updates by email.' });
      }
      if (req.body.orderEmail && (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL)) {
        return res.status(503).json({ error: 'Order email is not configured yet. Please try again later.' });
      }
      await getDatabase().collection('users').updateOne(
        { _id: req.user._id },
        { $set: { 'preferences.orderEmail': req.body.orderEmail, updatedAt: new Date() } },
      );
      res.json({ orderEmail: req.body.orderEmail });
    } catch (error) {
      next(error);
    }
  });

  router.get('/export', requireUser, async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store');
      const [user, orders, reminders] = await Promise.all([
        getDatabase().collection('users').findOne(
          { _id: req.user._id },
          { projection: { name: 1, email: 1, phone: 1, addresses: 1, defaultAddressId: 1, preferences: 1, cartItems: 1, wishlist: 1, createdAt: 1, updatedAt: 1 } },
        ),
        getDatabase().collection('orders').find(
          { userId: req.user._id },
          { projection: { _id: 0, orderId: 1, customer: 1, email: 1, lines: 1, sub: 1, off: 1, couponCode: 1, ship: 1, giftFee: 1, total: 1, giftMessage: 1, status: 1, paymentMethod: 1, paymentStatus: 1, createdAt: 1 } },
        ).sort({ createdAt: -1 }).toArray(),
        getDatabase().collection('gift_reminders').find(
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

  router.get('/sessions', requireUser, async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store');
      const token = readCookie(req, SESSION_COOKIE);
      const tokenHash = hashToken(token);
      const sessions = getDatabase().collection('sessions');
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

  router.delete('/sessions/others', requireUser, async (req, res, next) => {
    try {
      const token = readCookie(req, SESSION_COOKIE);
      if (!/^[a-f0-9]{64}$/.test(token)) return res.status(401).json({ error: 'Please sign in again to manage sessions.' });
      const result = await getDatabase().collection('sessions').deleteMany({
        userId: req.user._id,
        tokenHash: { $ne: hashToken(token) },
      });
      res.json({ revoked: result.deletedCount });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/sessions/:sessionId', requireUser, async (req, res, next) => {
    try {
      if (!ObjectId.isValid(req.params.sessionId)) return res.status(400).json({ error: 'Choose a valid session.' });
      const token = readCookie(req, SESSION_COOKIE);
      const sessions = getDatabase().collection('sessions');
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

  router.get('/search', requireUser, async (req, res, next) => {
    try {
      const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80).toLocaleLowerCase() : '';
      if (query.length < 2) return res.status(400).json({ error: 'Enter at least 2 characters to search your account.' });
      const user = await getDatabase().collection('users').findOne(
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
      const reminders = await getDatabase().collection('gift_reminders').find(
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
      const orders = await getDatabase().collection('orders')
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

  router.delete('/', requireUser, async (req, res, next) => {
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
          await getDatabase().collection('orders').updateMany(
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
          await getDatabase().collection('sessions').deleteMany({ userId: req.user._id }, { session });
          await getDatabase().collection('gift_reminders').deleteMany({ userId: req.user._id }, { session });
          await getDatabase().collection('password_reset_codes').deleteOne({ _id: req.user.email }, { session });
          await getDatabase().collection('users').deleteOne({ _id: req.user._id }, { session });
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

  return router;
};
