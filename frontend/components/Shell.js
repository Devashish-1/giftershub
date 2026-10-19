'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCart } from './CartProvider';
import { inr } from '../lib/api';
import ContactWidget from './ContactWidget';
import { useAuth } from './AuthProvider';

const NAV = [['Hampers', 'gift-hampers'], ['Idols', 'idols'], ['Car Murtis', 'car-murtis'], ['Photo Frames', 'photo-frames']];
const SOCIAL = [
  ['Instagram', 'https://www.instagram.com/thegiftershub/'],
  ['Facebook', 'https://www.facebook.com/p/thegiftershub-61563390688639'],
  ['Magicpin', 'https://magicpin.in/New-Delhi/Jai-Vihar/Other/The-Gifters-Hub/store/26062b4'],
  ['YouTube', 'https://www.youtube.com/@Thegiftershub-TGH'],
];
const ADDRESS = 'B - 21, Street No. 3, Dichaon Enclave, Kalan, Dichaon Kalan, Delhi, 110043, Jai Vihar, New Delhi';
const MAP_URL = 'https://www.google.com/maps?q=28.6297333,76.996915';
const MAP_EMBED_URL = 'https://maps.google.com/maps?q=28.6297333%2C76.996915&z=15&output=embed';

export default function Shell({ children }) {
  const { count, setOpen } = useCart(), { user, openLogin, logout, authError } = useAuth(), router = useRouter(), pathname = usePathname(), [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard?.writeText('GIFTHUB10'); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (<>
    <div className="ann">Free shipping over ₹999 · Code <button onClick={copy}>{copied ? 'Copied!' : 'GIFTHUB10'}</button> for 10% off</div>
    <header className="top"><div className="wrap bar">
      <Link href="/" className="logo"><img src="/logo-mark.png" alt="" /><span>The Gifter’s Hub<small>GIFTS &amp; DECOR</small></span></Link>
      <nav className="main">{NAV.map(([n, s]) => <Link key={s} href={`/shop?category=${s}`}>{n}</Link>)}</nav>
      <div className="tools">
        <form className="search" onSubmit={e => { e.preventDefault(); router.push(`/shop?q=${encodeURIComponent(new FormData(e.target).get('q'))}`); }}><input name="q" placeholder="Search" /></form>
        {user
          ? <div className="account-control"><span className="account-greeting">Hi, {user.name.split(' ')[0]}</span><button className="account-link" onClick={logout}>Sign out</button></div>
          : <button className="login-btn" onClick={openLogin}>Sign in</button>}
        <button className="cartbtn" onClick={() => setOpen(true)}>Cart{count > 0 && <i>{count}</i>}</button>
      </div>
    </div></header>
    {authError && <div className="auth-global-error" role="status">{authError}</div>}
    <main>{children}</main>
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <Link href="/" className="logo"><img src="/logo-mark.png" alt="" /><span>The Gifter’s Hub<small>GIFTS &amp; DECOR</small></span></Link>
          <p>Thoughtful gifts, divine idols and keepsakes for the moments worth remembering.</p>
          <div className="footer-social">{SOCIAL.map(([name, url]) => <a key={name} href={url} target="_blank" rel="noreferrer">{name}<span aria-hidden="true">↗</span></a>)}</div>
        </div>
        <div className="footer-links">
          <h3>Explore</h3>
          <nav>{NAV.map(([n, s]) => <Link key={s} href={`/shop?category=${s}`}>{n}</Link>)}</nav>
        </div>
        <div className="footer-contact">
          <h3>Visit or get in touch</h3>
          <a className="footer-address" href={MAP_URL} target="_blank" rel="noreferrer">{ADDRESS}<span>Get directions ↗</span></a>
          <a className="footer-phone" href="tel:+919555532044">+91 95555 32044</a>
          <a className="footer-magicpin" href={SOCIAL[2][1]} target="_blank" rel="noreferrer">Find us on Magicpin ↗</a>
        </div>
        <div className="footer-map">
          <iframe title="Map showing The Gifter’s Hub in Jai Vihar, New Delhi" src={MAP_EMBED_URL} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          <a href={MAP_URL} target="_blank" rel="noreferrer">Jai Vihar, New Delhi <b>Open map ↗</b></a>
        </div>
      </div>
      <div className="wrap footer-bottom"><span>© 2026 The Gifter’s Hub · Gifts &amp; Decor</span><span>Free shipping over ₹999 · Gift wrap available</span></div>
    </footer>
    <nav className="bottom">
      <Link href="/"><span>⌂</span>Home</Link><Link href="/shop"><span>▦</span>Shop</Link>
      <Link href="/shop?category=gift-hampers"><span>♡</span>Gifts</Link>
      <button onClick={() => setOpen(true)}><span>◌</span>Cart{count > 0 ? ` (${count})` : ''}</button>
    </nav>
    <Drawer />
    <ContactWidget productPage={pathname.startsWith('/product/')} />
  </>);
}

function Drawer() {
  const { items, setQty, open, setOpen } = useCart(), { requireAuth } = useAuth(), [gift, setGift] = useState(false), [code, setCode] = useState(''), [applied, setApplied] = useState(''), [q, setQ] = useState(null), router = useRouter();
  useEffect(() => {
    if (!open) return;
    fetch('/api/cart/price', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items, coupon: applied, gift }) }).then(r => r.json()).then(setQ).catch(() => {});
  }, [items, applied, gift, open]);
  const pct = q ? Math.min(100, ((q.sub - q.off) / 999) * 100) : 0;
  const go = () => {
    sessionStorage.setItem('gh-opts', JSON.stringify({ gift, coupon: applied }));
    setOpen(false);
    requireAuth(() => router.push('/checkout'));
  };
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
