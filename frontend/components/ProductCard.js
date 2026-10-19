'use client';
import Link from 'next/link';
import { inr } from '../lib/api';
import { useCart } from './CartProvider';
import AddButton from './AddButton';
export default function ProductCard({ p }) {
  const { wish, toggleWish } = useCart(), off = Math.round((1 - p.price / p.mrp) * 100);
  return (
    <div className="card">
      <Link href={`/product/${p.slug}`} className="img">
        {p.demoVisual && <span className="badge">Demo visual</span>}
        {!p.demoVisual && p.sourceName && <span className="badge">{p.sourceName} listing</span>}
        {!p.demoVisual && !p.sourceName && p.badge === 'New' && <span className="badge">New</span>}
        <span className="ph">{p.name[0]}</span>
        <img src={p.image || `/products/${p.slug}.jpg`} alt={p.demoVisual ? `Demo illustration for ${p.name}` : p.name} loading="lazy" onError={e => e.currentTarget.remove()} />
        <button className="heart" aria-label="Wishlist" onClick={e => { e.preventDefault(); toggleWish(p.slug); }}>{wish.includes(p.slug) ? '♥' : '♡'}</button>
        <div className="quick"><AddButton product={p} label="Quick add" /></div>
      </Link>
      <div className="meta">
        <h3><Link href={`/product/${p.slug}`}>{p.name}</Link></h3>
        <div className="pr"><b>{inr(p.price)}</b><s>{inr(p.mrp)}</s><em>{off}% off</em></div>
      </div>
    </div>
  );
}
