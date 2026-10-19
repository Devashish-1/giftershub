'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useCart } from '../../components/CartProvider';
export default function Checkout() {
  const { items, clear } = useCart(), [f, setF] = useState({ name: '', phone: '', pincode: '', address: '' }), [msg, setMsg] = useState(''), [err, setErr] = useState(''), [done, setDone] = useState(null), [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr('');
    const o = JSON.parse(sessionStorage.getItem('gh-opts') || '{}');
    const r = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: items.map(i => ({ slug: i.slug, qty: i.qty })), coupon: o.coupon, gift: o.gift, giftMessage: msg, customer: f }) });
    const d = await r.json(); setBusy(false);
    if (!r.ok) return setErr(d.error || 'Something went wrong'); clear(); setDone(d);
  };
  const set = k => e => setF({ ...f, [k]: e.target.value });
  if (done) return <div className="wrap form"><h1>Thank you!</h1><p>Order <b>{done.id}</b> is confirmed. Total: ₹{done.total}. We will WhatsApp you tracking details.</p><Link className="btn" href="/shop">Continue shopping</Link></div>;
  if (!items.length) return <div className="wrap form"><p>Your cart is empty.</p><Link className="btn" href="/shop">Shop now</Link></div>;
  return (<form className="wrap form" onSubmit={submit}>
    <h1>Delivery details</h1>
    <input required placeholder="Full name" value={f.name} onChange={set('name')} />
    <input required placeholder="10-digit mobile" inputMode="numeric" maxLength={10} value={f.phone} onChange={set('phone')} />
    <input required placeholder="Pincode" maxLength={6} value={f.pincode} onChange={set('pincode')} />
    <textarea required rows={3} placeholder="Full address" value={f.address} onChange={set('address')} />
    <textarea rows={2} placeholder="Gift message (optional)" value={msg} onChange={e => setMsg(e.target.value)} />
    {err && <div className="bad">{err}</div>}
    <button className="btn alt" disabled={busy}>{busy ? 'Placing order…' : 'Place order (COD)'}</button>
  </form>);
}
