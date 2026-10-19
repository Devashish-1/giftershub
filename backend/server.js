const express = require('express'), cors = require('cors'), fs = require('fs'), path = require('path');
const app = express(); app.use(cors()); app.use(express.json());
const products = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/products.json'), 'utf8'));
const FREE_SHIP = 999, GIFT_WRAP = 99;
const coupons = { GIFTHUB10: { type: 'pct', value: 10 }, UPI5: { type: 'pct', value: 5 }, DIWALI100: { type: 'flat', value: 100, min: 799 } };
const orders = []; // swap for MongoDB/Postgres in production

app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/api/products', (req, res) => {
  const { category, q, sort, min, max } = req.query;
  let list = products.filter(p =>
    (!category || p.category === category) &&
    (!q || (p.name + p.desc).toLowerCase().includes(String(q).toLowerCase())) &&
    (!min || p.price >= +min) && (!max || p.price <= +max));
  const s = { low: (a, b) => a.price - b.price, high: (a, b) => b.price - a.price, rating: (a, b) => b.rating - a.rating };
  if (s[sort]) list = [...list].sort(s[sort]);
  res.json(list);
});
app.get('/api/products/:slug', (req, res) => {
  const p = products.find(x => x.slug === req.params.slug);
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json({ ...p, related: products.filter(x => x.category === p.category && x.slug !== p.slug).slice(0, 4) });
});
app.get('/api/pincode/:pin', (req, res) => {
  if (!/^[1-9]\d{5}$/.test(req.params.pin)) return res.status(400).json({ ok: false, message: 'Enter a valid 6-digit pincode' });
  const days = req.params.pin.startsWith('14') ? 2 : 4; // placeholder rule; plug in Shiprocket here
  const d = new Date(); d.setDate(d.getDate() + days);
  res.json({ ok: true, eta: d.toDateString().slice(0, 10), cod: true });
});
function price(items, code, gift) {
  const lines = items.map(i => { const p = products.find(x => x.slug === i.slug); return p && { ...i, name: p.name, unit: p.price, total: p.price * i.qty }; }).filter(Boolean);
  const sub = lines.reduce((a, l) => a + l.total, 0), c = coupons[(code || '').toUpperCase()];
  const off = c && (!c.min || sub >= c.min) ? (c.type === 'pct' ? Math.round(sub * c.value / 100) : c.value) : 0;
  const ship = sub - off >= FREE_SHIP || !sub ? 0 : 79, giftFee = gift ? GIFT_WRAP : 0;
  return { lines, sub, off, ship, giftFee, total: sub - off + ship + giftFee, toFree: Math.max(0, FREE_SHIP - (sub - off)), couponOk: !!off };
}
app.post('/api/cart/price', (req, res) => res.json(price(req.body.items || [], req.body.coupon, req.body.gift)));
app.post('/api/orders', (req, res) => {
  const { items, coupon, gift, customer } = req.body;
  if (!items?.length || !customer?.name || !/^\d{10}$/.test(customer.phone || '') || !customer?.address) return res.status(400).json({ error: 'Missing details' });
  const order = { id: 'GH' + Date.now().toString().slice(-7), ...price(items, coupon, gift), customer, giftMessage: req.body.giftMessage || '', createdAt: new Date() };
  orders.push(order); res.status(201).json({ id: order.id, total: order.total });
});
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, HOST, () => console.log(`API on http://${HOST}:${PORT}`));
