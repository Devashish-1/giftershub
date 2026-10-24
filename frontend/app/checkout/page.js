'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '../../components/CartProvider';
import { useAuth } from '../../components/AuthProvider';
import { inr } from '../../lib/api';
export default function Checkout() {
  const router = useRouter();
  const { items, clear, syncing } = useCart(), { user, loading, openLogin } = useAuth(), [f, setF] = useState({ name: '', phone: '', pincode: '', address: '' }), [msg, setMsg] = useState(''), [err, setErr] = useState(''), [done, setDone] = useState(null), [busy, setBusy] = useState(false), [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [gift, setGift] = useState(false), [code, setCode] = useState(''), [coupon, setCoupon] = useState(''), [quote, setQuote] = useState(null), [quoteError, setQuoteError] = useState(''), [delivery, setDelivery] = useState(null);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [defaultAddressId, setDefaultAddressId] = useState('');
  const [savedDetailsError, setSavedDetailsError] = useState('');
  useEffect(() => {
    try {
      const options = JSON.parse(sessionStorage.getItem('gh-opts') || '{}');
      setGift(Boolean(options.gift));
      setCode(typeof options.coupon === 'string' ? options.coupon : '');
      setCoupon(typeof options.coupon === 'string' ? options.coupon : '');
    } catch {
      setErr('Your saved checkout options could not be loaded. Please review your cart options.');
    }
  }, []);
  useEffect(() => { if (!loading && !user && items.length) openLogin(); }, [loading, user, items.length, openLogin]);
  useEffect(() => { if (!loading && user?.role === 'admin') router.replace('/admin'); }, [loading, user, router]);
  useEffect(() => {
    setQuote(null);
    setQuoteError('');
    if (!items.length) {
      return undefined;
    }
    const controller = new AbortController();
    fetch('/api/cart/price', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: items.map(item => ({ slug: item.slug, qty: item.qty, variant: item.variant })), coupon, gift }),
    }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not confirm the current cart prices.');
      if (!controller.signal.aborted) {
        setQuote(result);
        setQuoteError('');
      }
    }).catch(error => {
      if (!controller.signal.aborted) {
        setQuote(null);
        setQuoteError(error.message || 'Could not confirm the current cart prices.');
      }
    });
    return () => controller.abort();
  }, [items, coupon, gift]);
  useEffect(() => {
    if (!/^[1-9]\d{5}$/.test(f.pincode)) {
      setDelivery(null);
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/pincode/${f.pincode}`, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.message || 'Delivery estimate is unavailable.');
        if (!controller.signal.aborted) setDelivery({ eta: result.eta, error: '' });
      } catch (error) {
        if (!controller.signal.aborted) setDelivery({ eta: '', error: error.message || 'Delivery estimate is unavailable.' });
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [f.pincode]);
  useEffect(() => {
    if (!user || user.role === 'admin') return undefined;
    let active = true;
    Promise.all([
      fetch('/api/account/profile', { credentials: 'same-origin' }).then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not load saved personal details.');
        return result.profile;
      }),
      fetch('/api/account/addresses', { credentials: 'same-origin' }).then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not load saved addresses.');
        return result;
      }),
    ]).then(([profile, addressResult]) => {
      if (!active) return;
      const addresses = addressResult.addresses || [];
      setSavedAddresses(addresses);
      const preferredAddress = addresses.find(address => address.id === addressResult.defaultAddressId) || addresses[0];
      setSelectedAddressId(preferredAddress?.id || '');
      setDefaultAddressId(preferredAddress?.id || '');
      setF(current => ({
        name: current.name || preferredAddress?.name || profile.name || '',
        phone: current.phone || preferredAddress?.phone || profile.phone || '',
        pincode: current.pincode || preferredAddress?.pincode || '',
        address: current.address || preferredAddress?.address || '',
      }));
    }).catch(error => {
      if (active) setSavedDetailsError(error.message || 'Could not load saved checkout details.');
    });
    return () => { active = false; };
  }, [user]);
  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const r = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: items.map(i => ({ slug: i.slug, qty: i.qty, variant: i.variant })), coupon, gift, giftMessage: msg, customer: f }) });
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
  if (done) return <div className="wrap form"><h1>Thank you!</h1><p>Order <b>{done.id}</b> is confirmed. Total: ₹{done.total}. You can receive order updates by email from your account notification settings.</p><Link className="btn" href="/shop">Continue shopping</Link></div>;
  if (loading) return <div className="wrap form"><p>Checking your account…</p></div>;
  if (user?.role === 'admin') return <div className="wrap form"><p>Customer checkout is unavailable to administrators.</p><Link className="btn" href="/admin">Open admin dashboard</Link></div>;
  if (!user) return <div className="wrap form"><h1>Sign in to checkout</h1><p>Your cart is saved while you sign in or create an account.</p><button className="btn alt" type="button" onClick={openLogin}>Sign in or create account</button></div>;
  if (syncing) return <div className="wrap form"><p>Restoring your saved cart…</p></div>;
  if (!items.length) return <div className="wrap form"><p>Your cart is empty.</p><Link className="btn" href="/shop">Shop now</Link></div>;
  return (<form className="wrap form" onSubmit={submit}>
    <h1>Delivery details</h1>
    {savedDetailsError && <p className="account-message account-error" role="status">{savedDetailsError}</p>}
    {savedAddresses.length > 0 && <label className="checkout-saved-address">Use a saved address
      <select value={selectedAddressId} onChange={event => {
        const address = savedAddresses.find(value => value.id === event.target.value);
        setSelectedAddressId(event.target.value);
        if (address) setF(current => ({ ...current, name: address.name, phone: address.phone, pincode: address.pincode, address: address.address }));
      }}><option value="">Enter a different address</option>{savedAddresses.map(address => <option key={address.id} value={address.id}>{address.label}{address.id === defaultAddressId ? ' · Default' : ''} · {address.address}</option>)}</select>
    </label>}
    <input required placeholder="Full name" value={f.name} onChange={set('name')} />
    <input required placeholder="10-digit mobile" inputMode="numeric" maxLength={10} value={f.phone} onChange={set('phone')} />
    <input required placeholder="Pincode" maxLength={6} value={f.pincode} onChange={set('pincode')} />
    {delivery?.eta && <p className="checkout-delivery-estimate" role="status">Estimated delivery: <strong>{delivery.eta}</strong></p>}
    {delivery?.error && <p className="checkout-delivery-error" role="status">{delivery.error}</p>}
    <textarea required rows={3} placeholder="Full address" value={f.address} onChange={set('address')} />
    <textarea rows={2} placeholder="Gift message (optional)" value={msg} onChange={e => setMsg(e.target.value)} />
    <section className="checkout-summary" aria-labelledby="checkout-summary-title">
      <h2 id="checkout-summary-title">Order summary</h2>
      {items.map(item => {
        const pricedLine = quote?.lines.find(line => line.slug === item.slug && line.variant === (item.variant || ''));
        return <div className="row" key={item.key}><span>{item.name}{item.variant ? ` · ${item.variant}` : ''} × {item.qty}</span><span>{inr(pricedLine?.total ?? item.price * item.qty)}</span></div>;
      })}
      <p className="gst-included-note">Product prices include GST.</p>
      <label className="checkout-gift-option"><input type="checkbox" checked={gift} onChange={event => {
        const enabled = event.target.checked;
        setGift(enabled);
        sessionStorage.setItem('gh-opts', JSON.stringify({ gift: enabled, coupon }));
      }} /> Gift wrap + greeting card (+₹99)</label>
      <div className="checkout-coupon"><input value={code} onChange={event => setCode(event.target.value)} placeholder="Coupon code" aria-label="Coupon code" /><button type="button" onClick={() => {
        const nextCoupon = code.trim().toUpperCase();
        setCoupon(nextCoupon);
        sessionStorage.setItem('gh-opts', JSON.stringify({ gift, coupon: nextCoupon }));
      }}>Apply</button></div>
      {coupon && quote && <p className={quote.couponOk ? 'ok' : 'bad'} role="status">{quote.couponOk ? `${coupon.toUpperCase()} applied${quote.couponCapped ? ' with an adjusted discount' : ''}` : quote.couponCapped ? 'This coupon cannot be applied to the current basket.' : 'Coupon is invalid or its minimum spend is not met.'}</p>}
      {quoteError && <p className="bad" role="alert">{quoteError}</p>}
      {quote && <>
        <div className="row"><span>Subtotal (incl. GST)</span><span>{inr(quote.sub)}</span></div>
        {quote.off > 0 && <div className="row"><span>Discount</span><span>−{inr(quote.off)}</span></div>}
        <div className="row"><span>GST included in products</span><span>{inr(quote.taxIncluded)}</span></div>
        <div className="row"><span>Shipping</span><span>{quote.ship ? inr(quote.ship) : 'Free'}</span></div>
        {quote.giftFee > 0 && <div className="row"><span>Gift wrap</span><span>{inr(quote.giftFee)}</span></div>}
        <div className="row checkout-total"><strong>Total</strong><strong>{inr(quote.total)}</strong></div>
      </>}
    </section>
    <section className="checkout-payment" aria-labelledby="payment-title">
      <h2 id="payment-title">Payment method</h2>
      <button className="payment-placeholder" type="button" disabled>Pay online <span>Coming soon</span></button>
      <p>Cash on Delivery is currently available.</p>
    </section>
    <label className="checkout-policy"><input required type="checkbox" checked={acceptedPolicies} onChange={event => setAcceptedPolicies(event.target.checked)} /><span>I agree to the <Link href="/terms" target="_blank">Terms &amp; Conditions</Link> and have read the <Link href="/privacy" target="_blank">Privacy Policy</Link>.</span></label>
    {err && <div className="bad">{err}</div>}
    <button className="btn alt" disabled={busy || !quote || Boolean(quoteError)}>{busy ? 'Placing order…' : quote ? `Place order · ${inr(quote.total)}` : 'Confirming price…'}</button>
  </form>);
}
