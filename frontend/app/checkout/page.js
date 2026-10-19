'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCart } from '../../components/CartProvider';
import { useAuth } from '../../components/AuthProvider';
export default function Checkout() {
  const { items, clear } = useCart(), { user, loading, openLogin } = useAuth(), [f, setF] = useState({ name: '', phone: '', pincode: '', address: '' }), [msg, setMsg] = useState(''), [err, setErr] = useState(''), [done, setDone] = useState(null), [busy, setBusy] = useState(false), [acceptedPolicies, setAcceptedPolicies] = useState(false);
  useEffect(() => { if (!loading && !user && items.length) openLogin(); }, [loading, user, items.length, openLogin]);
  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const o = JSON.parse(sessionStorage.getItem('gh-opts') || '{}');
      const r = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: items.map(i => ({ slug: i.slug, qty: i.qty })), coupon: o.coupon, gift: o.gift, giftMessage: msg, customer: f }) });
      const d = await r.json();
      if (!r.ok) return setErr(d.error || 'Something went wrong');
      clear(); setDone(d);
    } catch {
      setErr('Could not connect to checkout. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  const set = k => e => setF({ ...f, [k]: e.target.value });
  if (done) return <div className="wrap form"><h1>Thank you!</h1><p>Order <b>{done.id}</b> is confirmed. Total: ₹{done.total}. We will WhatsApp you tracking details.</p><Link className="btn" href="/shop">Continue shopping</Link></div>;
  if (loading) return <div className="wrap form"><p>Checking your account…</p></div>;
  if (!user) return <div className="wrap form"><h1>Sign in to checkout</h1><p>Your cart is saved while you sign in or create an account.</p><button className="btn alt" type="button" onClick={openLogin}>Sign in or create account</button></div>;
  if (!items.length) return <div className="wrap form"><p>Your cart is empty.</p><Link className="btn" href="/shop">Shop now</Link></div>;
  return (<form className="wrap form" onSubmit={submit}>
    <h1>Delivery details</h1>
    <input required placeholder="Full name" value={f.name} onChange={set('name')} />
    <input required placeholder="10-digit mobile" inputMode="numeric" maxLength={10} value={f.phone} onChange={set('phone')} />
    <input required placeholder="Pincode" maxLength={6} value={f.pincode} onChange={set('pincode')} />
    <textarea required rows={3} placeholder="Full address" value={f.address} onChange={set('address')} />
    <textarea rows={2} placeholder="Gift message (optional)" value={msg} onChange={e => setMsg(e.target.value)} />
    <section className="checkout-payment" aria-labelledby="payment-title">
      <h2 id="payment-title">Payment method</h2>
      <button className="payment-placeholder" type="button" disabled>Pay online <span>Coming soon</span></button>
      <p>Cash on Delivery is currently available.</p>
    </section>
    <label className="checkout-policy"><input required type="checkbox" checked={acceptedPolicies} onChange={event => setAcceptedPolicies(event.target.checked)} /><span>I agree to the <Link href="/terms" target="_blank">Terms &amp; Conditions</Link> and have read the <Link href="/privacy" target="_blank">Privacy Policy</Link>.</span></label>
    {err && <div className="bad">{err}</div>}
    <button className="btn alt" disabled={busy}>{busy ? 'Placing order…' : 'Place order (COD)'}</button>
  </form>);
}
