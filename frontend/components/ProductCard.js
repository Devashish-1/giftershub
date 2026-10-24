'use client';
import Link from 'next/link';
import Image from 'next/image';
import { inr } from '../lib/api';
import { useCart } from './CartProvider';
import { useAuth } from './AuthProvider';
import AddButton from './AddButton';
export default function ProductCard({ p, priority = false }) {
  const { wish, toggleWish } = useCart();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const priceAvailable = p.available !== false && Number.isFinite(p.price) && p.price > 0;
  const image = p.image || `/products/${p.slug}.webp`;
  const alternateImage = p.gallery?.find(src => src !== image);
  const isWished = wish.includes(p.slug);
  const off = priceAvailable && Number.isFinite(p.mrp) && p.mrp > p.price
    ? Math.round((1 - p.price / p.mrp) * 100)
    : null;
  return (
    <div className="card">
      <div className={`img${alternateImage ? ' has-alternate' : ''}`}>
        <Link href={`/product/${p.slug}`} className="card-image-link" aria-label={`View ${p.name}`}>
          <span className="ph" aria-hidden="true">{p.name[0]}</span>
          <Image className="card-image-main" src={image} alt={p.name} fill sizes="(max-width: 520px) calc(100vw - 32px), (max-width: 900px) calc(50vw - 24px), (max-width: 1180px) 22vw, 270px" priority={priority} fetchPriority={priority ? 'high' : 'low'} style={{ objectFit: 'contain' }} onError={e => e.currentTarget.remove()} />
          {alternateImage && <Image className="card-image-alternate" src={alternateImage} alt="" fill sizes="(max-width: 520px) calc(100vw - 32px), (max-width: 900px) calc(50vw - 24px), (max-width: 1180px) 22vw, 270px" loading="lazy" fetchPriority="low" style={{ objectFit: 'contain' }} />}
        </Link>
        <span className="badge">{priceAvailable ? 'Ready to order' : 'Price coming soon'}</span>
        {!isAdmin && <button className="heart" type="button" aria-label={`${isWished ? 'Remove' : 'Add'} ${p.name} ${isWished ? 'from' : 'to'} wishlist`} aria-pressed={isWished} onClick={() => toggleWish(p.slug)}>{isWished ? '♥' : '♡'}</button>}
        {priceAvailable && !isAdmin && <div className="quick"><AddButton product={p} label="Add to cart" /></div>}
      </div>
      <div className="meta">
        <h3><Link href={`/product/${p.slug}`}>{p.name}</Link></h3>
        {p.subject && <span className="product-card-subject">{p.subject}</span>}
        {priceAvailable && <><div className="pr"><b>{inr(p.price)}</b>{Number.isFinite(p.mrp) && <s>{inr(p.mrp)}</s>}{off > 0 && <em>{off}% off</em>}</div><small className="gst-included-note">Inclusive of GST</small></>}
      </div>
    </div>
  );
}
