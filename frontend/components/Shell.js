'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useCart } from './CartProvider';
import { inr } from '../lib/api';
import { GOD_FRAME_SUBJECTS } from '../lib/catalog';
import { shopCategoryHref, shopSubjectHref } from '../lib/shop-categories';
import ContactWidget from './ContactWidget';
import { useAuth } from './AuthProvider';

const DEITY_LINKS = GOD_FRAME_SUBJECTS.map(subject => [
  subject,
  shopSubjectHref('god-frames', subject),
]);
const NAV = [
  ['God Frames', shopCategoryHref('god-frames'), [['All God Frames', shopCategoryHref('god-frames')], ...DEITY_LINKS]],
  ['Family Frames', shopCategoryHref('family-frames'), [['Family Photo Frames', shopCategoryHref('family-frames')]]],
  ['Crystal Bubble', shopCategoryHref('crystal-bubble'), [['All Crystal Bubble Frames', shopCategoryHref('crystal-bubble')]]],
  ['Murtis & Idols', shopCategoryHref('murtis-and-idols'), DEITY_LINKS],
];
const NAV_DESCRIPTIONS = {
  'God Frames': 'Devotional art for your home',
  'Family Frames': 'Photo displays for home and gifting',
  'Crystal Bubble': 'Keepsakes with a little sparkle',
  'Murtis & Idols': 'Explore sacred forms by deity',
};
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
  const { count, setOpen } = useCart(), { user, openLogin, logout, authError } = useAuth(), router = useRouter(), pathname = usePathname();
  const isAccountPage = pathname === '/account' || pathname.startsWith('/account/');
  const showFooter = pathname === '/account' || !pathname.startsWith('/account/');
  const [activeNav, setActiveNav] = useState(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountSearchQuery, setAccountSearchQuery] = useState('');
  const [accountSearch, setAccountSearch] = useState({ results: [], error: '', searched: false, busy: false });
  const accountControl = useRef(null);
  const mobileMenuButton = useRef(null);
  const mobileNavigation = useRef(null);
  useEffect(() => {
    if (!accountMenuOpen) return undefined;
    const closeOnEscape = event => {
      if (event.key === 'Escape') setAccountMenuOpen(false);
    };
    const closeOutside = event => {
      if (!accountControl.current?.contains(event.target)) setAccountMenuOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOutside);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOutside);
    };
  }, [accountMenuOpen]);
  useEffect(() => {
    setAccountSearchQuery('');
    setAccountSearch({ results: [], error: '', searched: false, busy: false });
  }, [pathname]);
  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = mobileNavigation.current?.querySelectorAll('a, button');
    focusable?.[0]?.focus();

    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
        mobileMenuButton.current?.focus();
      }
      if (event.key !== 'Tab' || !focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenuOpen]);
  const searchAccount = async event => {
    event.preventDefault();
    const query = accountSearchQuery.trim();
    if (query.length < 2) {
      setAccountSearch({ results: [], error: 'Enter at least 2 characters to search your account.', searched: true, busy: false });
      return;
    }
    setAccountSearch({ results: [], error: '', searched: false, busy: true });
    try {
      const response = await fetch(`/api/account/search?q=${encodeURIComponent(query)}`, { credentials: 'same-origin' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not search your account.');
      setAccountSearch({ results: result.results, error: '', searched: true, busy: false });
    } catch (error) {
      setAccountSearch({ results: [], error: error.message || 'Could not search your account.', searched: true, busy: false });
    }
  };
  return (<>
    <div className="ann">New catalogue collection · Retail prices coming soon</div>
    <header className={`top${pathname.startsWith('/admin') ? ' admin-top' : ''}${isAccountPage ? ' account-top' : ''}`}><div className="wrap bar">
      <Link href="/" className="logo"><img src="/logo-mark.png" alt="" /><span>The Gifter’s Hub<small>GIFTS &amp; DECOR</small></span></Link>
      {!isAccountPage && <nav
        className="main"
        aria-label="Main navigation"
        onMouseLeave={() => setActiveNav(null)}
        onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget)) setActiveNav(null);
        }}
      >{NAV.map(([name, href, subcategories]) => <div
        className={`nav-item${activeNav === name ? ' is-open' : ''}`}
        key={name}
        onMouseEnter={() => setActiveNav(name)}
        onFocus={() => setActiveNav(name)}
      >
        <Link className="nav-link" href={href} aria-haspopup="true" aria-expanded={activeNav === name}>{name}</Link>
        <div className="nav-dropdown" aria-label={`${name} subcategories`} aria-hidden={activeNav !== name}>
          {subcategories.map(([subcategory, subcategoryHref]) => <Link key={subcategory} href={subcategoryHref}>{subcategory}</Link>)}
        </div>
      </div>)}      </nav>}
      <div className="tools">
        {isAccountPage
          ? <div className="account-search-wrap">
            <form className="search account-search" role="search" onSubmit={searchAccount}>
              <label className="sr-only" htmlFor="header-search">Search your account details</label>
              <input id="header-search" value={accountSearchQuery} onChange={event => {
                setAccountSearchQuery(event.target.value);
                setAccountSearch({ results: [], error: '', searched: false, busy: false });
              }} placeholder="Search your account details" autoComplete="off" />
              <button type="submit" aria-label="Search account" disabled={accountSearch.busy}>{accountSearch.busy ? 'Searching…' : 'Search'}</button>
            </form>
            {(accountSearch.error || accountSearch.searched) && <div className="account-search-results" role="status">
              {accountSearch.error
                ? <p>{accountSearch.error}</p>
                : accountSearch.results.length
                  ? accountSearch.results.map((result, index) => <Link key={`${result.href}-${result.title}-${index}`} href={result.href} onClick={() => setAccountSearch({ results: [], error: '', searched: false, busy: false })}>
                    <strong>{result.title}</strong><span>{result.detail}</span>
                  </Link>)
                  : <p>No matching account details found.</p>}
            </div>}
          </div>
          : <form className="search" role="search" onSubmit={e => { e.preventDefault(); router.push(`/shop?q=${encodeURIComponent(new FormData(e.target).get('q'))}`); }}><label className="sr-only" htmlFor="header-search">Search products</label><input id="header-search" name="q" placeholder="Search designs" /><button type="submit" aria-label="Search catalogue">Search</button></form>}
        {user
          ? <Link className="mobile-account-link" href={user.role === 'admin' ? '/admin' : '/account'} aria-label={user.role === 'admin' ? 'Open admin dashboard' : 'Open account page'}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20c.6-4 3.2-6 7.5-6s6.9 2 7.5 6" /></svg>
          </Link>
          : <button className="mobile-account-link" type="button" aria-label="Sign in or create account" onClick={openLogin}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20c.6-4 3.2-6 7.5-6s6.9 2 7.5 6" /></svg>
          </button>}
        {user
          ? <div className="account-control" ref={accountControl}>
            <button className="account-icon" type="button" aria-label="Account menu" aria-haspopup="menu" aria-expanded={accountMenuOpen} onClick={() => setAccountMenuOpen(current => !current)}>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20c.6-4 3.2-6 7.5-6s6.9 2 7.5 6" /></svg>
            </button>
            {accountMenuOpen && <div className="account-menu" role="menu" aria-label="Account">
              <div className="account-menu-user"><strong>{user.name}</strong><span>{user.email}</span></div>
              {user.role === 'admin'
                ? <Link role="menuitem" href="/admin" onClick={() => setAccountMenuOpen(false)}>Admin dashboard</Link>
                : <>
                  <Link role="menuitem" href="/account" onClick={() => setAccountMenuOpen(false)}>Account overview</Link>
                  <Link role="menuitem" href="/account/profile" onClick={() => setAccountMenuOpen(false)}>Personal details</Link>
                  <Link role="menuitem" href="/account/addresses" onClick={() => setAccountMenuOpen(false)}>Addresses</Link>
                  <Link role="menuitem" href="/account/orders" onClick={() => setAccountMenuOpen(false)}>Orders</Link>
                  <Link role="menuitem" href="/account/wishlist" onClick={() => setAccountMenuOpen(false)}>Wishlist &amp; reminders</Link>
                  <Link role="menuitem" href="/account/coupons" onClick={() => setAccountMenuOpen(false)}>Coupons &amp; rewards</Link>
                  <Link role="menuitem" href="/account/payments" onClick={() => setAccountMenuOpen(false)}>Payment methods</Link>
                  <Link role="menuitem" href="/account/notifications" onClick={() => setAccountMenuOpen(false)}>Email notifications</Link>
                  <Link role="menuitem" href="/account/privacy" onClick={() => setAccountMenuOpen(false)}>Privacy controls</Link>
                  <Link role="menuitem" href="/account/security" onClick={() => setAccountMenuOpen(false)}>Security</Link>
                </>}
              <button role="menuitem" type="button" onClick={() => { setAccountMenuOpen(false); logout(); }}>Sign out</button>
            </div>}
          </div>
          : <button className="login-btn" onClick={openLogin}>Sign in</button>}
        {user?.role !== 'admin' && <button className="cartbtn" onClick={() => setOpen(true)}>Cart{count > 0 && <i>{count}</i>}</button>}
      </div>
      {!isAccountPage && <button
        ref={mobileMenuButton}
        className="mobile-menu-toggle"
        type="button"
        aria-label="Open collection menu"
        aria-expanded={mobileMenuOpen}
        aria-controls={mobileMenuOpen ? 'mobile-navigation' : undefined}
        onClick={() => setMobileMenuOpen(true)}
      >
        <span /><span /><span />
      </button>}
    </div></header>
    {mobileMenuOpen && <div className="mobile-navigation">
      <button className="mobile-navigation-backdrop" type="button" aria-label="Close collection menu" onClick={() => {
        setMobileMenuOpen(false);
        mobileMenuButton.current?.focus();
      }} />
      <aside
        className="mobile-navigation-panel"
        id="mobile-navigation"
        ref={mobileNavigation}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-navigation-title"
      >
        <div className="mobile-navigation-header">
          <h2 id="mobile-navigation-title">Browse collections</h2>
          <button type="button" aria-label="Close collection menu" onClick={() => {
            setMobileMenuOpen(false);
            mobileMenuButton.current?.focus();
          }}>×</button>
        </div>
        <nav className="mobile-navigation-links" aria-label="Collections">
          <Link className="mobile-navigation-feature" href="/gifts" onClick={() => setMobileMenuOpen(false)}>Gifts by occasion <span aria-hidden="true">→</span></Link>
          {NAV.map(([name, href, subcategories]) => (
            <section key={name}>
              <Link className="mobile-navigation-category" href={href} onClick={() => setMobileMenuOpen(false)}>
                <span>{name}<small>{NAV_DESCRIPTIONS[name]}</small></span>
              </Link>
              <div className="mobile-navigation-subcategories">
                {subcategories.filter(([, subcategoryHref]) => subcategoryHref !== href).map(([subcategory, subcategoryHref]) => (
                  <Link key={`${name}-${subcategory}`} href={subcategoryHref} onClick={() => setMobileMenuOpen(false)}>{subcategory}</Link>
                ))}
              </div>
            </section>
          ))}
        </nav>
      </aside>
    </div>}
    {authError && <div className="auth-global-error" role="status">{authError}</div>}
    <main>{children}</main>
    {showFooter && <footer className="site-footer">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <Link href="/" className="logo"><img src="/logo-mark.png" alt="" /><span>The Gifter’s Hub<small>GIFTS &amp; DECOR</small></span></Link>
          <p>Thoughtful gifts, divine idols and keepsakes for the moments worth remembering.</p>
          <div className="footer-social">{SOCIAL.map(([name, url]) => <a key={name} href={url} target="_blank" rel="noreferrer">{name}<span aria-hidden="true">↗</span></a>)}</div>
        </div>
        <div className="footer-links">
          <h3>Explore</h3>
          <nav><Link href="/gifts">Gifts by occasion</Link>{NAV.map(([name, href]) => <Link key={name} href={href}>{name}</Link>)}</nav>
          <h3 className="footer-legal-heading">Policies</h3>
          <nav><Link href="/terms">Terms &amp; Conditions</Link><Link href="/privacy">Privacy Policy</Link></nav>
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
      <div className="wrap footer-bottom"><span>© 2026 The Gifter’s Hub · Gifts &amp; Decor</span><span>Retail catalogue · Prices coming soon</span></div>
    </footer>}
    <nav className={`bottom${user?.role === 'admin' ? ' admin-bottom' : ''}`}>
      <Link href="/"><span>⌂</span>Home</Link><Link href="/shop"><span>▦</span>Shop</Link>
      <Link href="/gifts"><span>♡</span>Gifts</Link>
      {user?.role !== 'admin' && <button onClick={() => setOpen(true)}><span>◌</span>Cart{count > 0 ? ` (${count})` : ''}</button>}
    </nav>
    <Drawer />
    <ContactWidget productPage={pathname.startsWith('/product/')} />
  </>);
}

function Drawer() {
  const { items, setQty, open, setOpen } = useCart(), { requireAuth } = useAuth(), [gift, setGift] = useState(false), [code, setCode] = useState(''), [applied, setApplied] = useState(''), [q, setQ] = useState(null), [quoteError, setQuoteError] = useState(''), router = useRouter();
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setQ(null);
    setQuoteError('');
    fetch('/api/cart/price', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: items.map(item => ({ slug: item.slug, qty: item.qty, variant: item.variant })), coupon: applied, gift }),
    }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not confirm cart prices.');
      if (!controller.signal.aborted) setQ(result);
    }).catch(error => {
      if (!controller.signal.aborted) setQuoteError(error.message || 'Could not confirm cart prices.');
    });
    return () => controller.abort();
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
        <div className="meter">{quoteError ? 'Shipping estimate unavailable' : !q ? 'Checking prices and shipping…' : q.toFree > 0 ? <>Add <b>{inr(q.toFree)}</b> more for free shipping</> : '🎉 You unlocked free shipping'}<div><i style={{ width: pct + '%' }} /></div></div>
        <div className="items">{items.map(i => {
          const quotedLine = q?.lines?.find(line => line.slug === i.slug && line.variant === (i.variant || ''));
          return <div className="line" key={i.key}>
          <div className="th">{(quotedLine?.name || i.name)[0]}</div>
          <div style={{ flex: 1 }}><b>{quotedLine?.name || i.name}</b>{i.variant && <div className="tag">{i.variant}</div>}
            <div className="qty"><button onClick={() => setQty(i.key, -1)}>−</button><span>{i.qty}</span><button onClick={() => setQty(i.key, 1)}>+</button></div></div>
          <b>{inr(quotedLine?.total ?? i.price * i.qty)}</b></div>;
        })}</div>
        <div className="df">
          <label><input type="checkbox" checked={gift} onChange={e => setGift(e.target.checked)} /> Gift wrap + greeting card (+₹99)</label>
          <div className="row"><input type="text" placeholder="Coupon code" value={code} onChange={e => setCode(e.target.value)} /><button className="btn ghost" style={{ padding: '8px 14px' }} onClick={() => setApplied(code)}>Apply</button></div>
          {applied && q && <div className={q.couponOk ? 'ok' : 'bad'}>{q.couponOk ? `${applied.toUpperCase()} applied${q.couponCapped ? ' with an adjusted discount' : ''}` : q.couponCapped ? 'Coupon unavailable for this basket' : 'Invalid code or minimum not met'}</div>}
          {quoteError && <div className="bad" role="alert">{quoteError}</div>}
          {q && <><div className="row"><span>Subtotal (incl. GST)</span><span>{inr(q.sub)}</span></div>
            {q.off > 0 && <div className="row ok"><span>Discount</span><span>−{inr(q.off)}</span></div>}
            <div className="row"><span>GST included</span><span>{inr(q.taxIncluded)}</span></div>
            <div className="row"><span>Shipping</span><span>{q.ship ? inr(q.ship) : 'Free'}</span></div>
            <div className="row"><b>Total</b><b>{inr(q.total)}</b></div></>}
          <button className="btn alt" onClick={go} disabled={!q || Boolean(quoteError)}>Checkout</button>
        </div></>}
    </aside></>);
}
