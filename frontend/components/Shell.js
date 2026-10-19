'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCart } from './CartProvider';
import { inr } from '../lib/api';

const NAV = [['Hampers', 'gift-hampers'], ['Idols', 'idols'], ['Car Murtis', 'car-murtis'], ['Malas', 'malas'], ['Pooja', 'pooja']];

export default function Shell({ children }) {
  const { count, setOpen } = useCart(), router = useRouter(), [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard?.writeText('GIFTHUB10'); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (<>
    <div className="ann">Free shipping over ₹999 · Code <button onClick={copy}>{copied ? 'Copied!' : 'GIFTHUB10'}</button> for 10% off</div>
    <header className="top"><div className="wrap bar">
      <Link href="/" className="logo"><img src="/logo-mark.png" alt="" /><span>The Gifter’s Hub<small>GIFTS &amp; DECOR</small></span></Link>
      <nav className="main">{NAV.map(([n, s]) => <Link key={s} href={`/shop?category=${s}`}>{n}</Link>)}</nav>
      <div className="tools">
        <form className="search" onSubmit={e => { e.preventDefault(); router.push(`/shop?q=${encodeURIComponent(new FormData(e.target).get('q'))}`); }}><input name="q" placeholder="Search" /></form>
        <button className="cartbtn" onClick={() => setOpen(true)}>Cart{count > 0 && <i>{count}</i>}</button>
      </div>
    </div></header>
    <main>{children}</main>
    <footer><div className="wrap">
      <span>© 2026 The Gifter’s Hub · Gifts &amp; Decor</span>
      <nav>{NAV.slice(0, 4).map(([n, s]) => <Link key={s} href={`/shop?category=${s}`}>{n}</Link>)}</nav>
    </div></footer>
    <nav className="bottom">
      <Link href="/"><span>⌂</span>Home</Link><Link href="/shop"><span>▦</span>Shop</Link>
      <Link href="/shop?category=gift-hampers"><span>♡</span>Gifts</Link>
      <button onClick={() => setOpen(true)}><span>◌</span>Cart{count > 0 ? ` (${count})` : ''}</button>
    </nav>
    <Drawer />
  </>);
}

function Drawer() {
  const { items, setQty, open, setOpen } = useCart(), [gift, setGift] = useState(false), [code, setCode] = useState(''), [applied, setApplied] = useState(''), [q, setQ] = useState(null), router = useRouter();
  useEffect(() => {
    if (!open) return;
    fetch('/api/cart/price', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items, coupon: applied, gift }) }).then(r => r.json()).then(setQ).catch(() => {});
  }, [items, applied, gift, open]);
  const pct = q ? Math.min(100, ((q.sub - q.off) / 999) * 100) : 0;
  const go = () => { setOpen(false); sessionStorage.setItem('gh-opts', JSON.stringify({ gift, coupon: applied })); router.push('/checkout'); };
  return (<>
    <div className={`scrim ${open ? 'on' : ''}`} onClick={() => setOpen(false)} />
    <aside className={`drawer ${open ? 'on' : ''}`}>
      <div className="dh"><h3>Your Cart</h3><button onClick={() => setOpen(false)} aria-label="Close">✕</button></div>
      {items.length === 0 ? <div className="items"><p style={{ padding: '40px 0', textAlign: 'center', color: 'var(--muted)' }}>Your cart is empty.<br /><br /><Link className="btn" href="/shop" onClick={() => setOpen(false)}>Start shopping</Link></p></div> : <>
        <div className="meter">{q && q.toFree > 0 ? <>Add <b>{inr(q.toFree)}</b> more for free shipping</> : '🎉 You unlocked free shipping'}<div><i style={{ width: pct + '%' }} /></div></div>
        <div className="items">{items.map(i => <div className="line" key={i.key}>
          <div className="th">{i.name[0]}</div>
          <div style={{ flex: 1 }}><b>{i.name}</b>{i.variant && <div className="tag">{i.variant}</div>}
            <div className="qty"><button onClick={() => setQty(i.key, -1)}>−</button><span>{i.qty}</span><button onClick={() => setQty(i.key, 1)}>+</button></div></div>
          <b>{inr(i.price * i.qty)}</b></div>)}</div>
        <div className="df">
          <label><input type="checkbox" checked={gift} onChange={e => setGift(e.target.checked)} /> Gift wrap + greeting card (+₹99)</label>
          <div className="row"><input type="text" placeholder="Coupon code" value={code} onChange={e => setCode(e.target.value)} /><button className="btn ghost" style={{ padding: '8px 14px' }} onClick={() => setApplied(code)}>Apply</button></div>
          {applied && q && <div className={q.couponOk ? 'ok' : 'bad'}>{q.couponOk ? `${applied.toUpperCase()} applied` : 'Invalid code or minimum not met'}</div>}
          {q && <><div className="row"><span>Subtotal</span><span>{inr(q.sub)}</span></div>
            {q.off > 0 && <div className="row ok"><span>Discount</span><span>−{inr(q.off)}</span></div>}
            <div className="row"><span>Shipping</span><span>{q.ship ? inr(q.ship) : 'Free'}</span></div>
            <div className="row"><b>Total</b><b>{inr(q.total)}</b></div></>}
          <button className="btn alt" onClick={go}>Checkout</button>
        </div></>}
    </aside></>);
}
