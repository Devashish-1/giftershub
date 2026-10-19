'use client';
import Link from 'next/link';
import { inr } from '../lib/api';
import { useCart } from './CartProvider';
import AddButton from './AddButton';
export default function ProductCard({ p }) {
  const { wish, toggleWish } = useCart();
  const priceAvailable = p.available !== false && Number.isFinite(p.price) && p.price > 0;
  const off = priceAvailable && Number.isFinite(p.mrp) && p.mrp > p.price
    ? Math.round((1 - p.price / p.mrp) * 100)
    : null;
  return (
    <div className="card">
      <Link href={`/product/${p.slug}`} className="img">
        {!priceAvailable && <span className="badge">Catalogue item</span>}
        <span className="ph">{p.name[0]}</span>
        <img src={p.image || `/products/${p.slug}.webp`} alt={p.name} loading="lazy" style={{ objectFit: 'contain' }} onError={e => e.currentTarget.remove()} />
        <button className="heart" aria-label="Wishlist" onClick={e => { e.preventDefault(); toggleWish(p.slug); }}>{wish.includes(p.slug) ? '♥' : '♡'}</button>
        {priceAvailable && <div className="quick"><AddButton product={p} label="Quick add" /></div>}
      </Link>
      <div className="meta">
        <h3><Link href={`/product/${p.slug}`}>{p.name}</Link></h3>
        {priceAvailable && <div className="pr"><b>{inr(p.price)}</b>{Number.isFinite(p.mrp) && <s>{inr(p.mrp)}</s>}{off > 0 && <em>{off}% off</em>}</div>}
      </div>
    </div>
  );
}
