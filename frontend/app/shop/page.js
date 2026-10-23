import Link from 'next/link';
import { get } from '../../lib/api';
import Reveal from '../../components/Reveal';
import ProductCard from '../../components/ProductCard';
import { GOD_FRAME_SUBJECTS } from '../../lib/catalog';
const CATS = [['All', ''], ['God Frames', 'god-frames'], ['Family Photo Frames', 'family-frames'], ['Crystal Bubble Frames', 'crystal-bubble']];
const PRICE_RANGES = [
  ['Any price', null, null],
  ['Under ₹500', null, '499'],
  ['₹500 – ₹999', '500', '999'],
  ['₹1,000 – ₹1,999', '1000', '1999'],
  ['₹2,000+', '2000', null],
];
export default async function Shop({ searchParams: sp }) {
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v)).toString();
  const list = (await get('/api/products?' + qs)) || [];
  const link = (o) => {
    const params = new URLSearchParams(Object.entries(sp).filter(([, v]) => v));
    for (const [key, value] of Object.entries(o)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    return '/shop?' + params.toString();
  };
  const title = sp.subject
    ? `${sp.subject} Frames`
    : CATS.find(c => c[1] === (sp.category || ''))?.[0] || 'Shop all';
  return (<div className="wrap shop">
    <div className="shop-heading">
      <div><span className="eyebrow">THE GIFTERS HUB CATALOGUE</span><h1>{sp.q ? `Results for “${sp.q}”` : title}</h1></div>
      <span className="shop-count">{list.length} {list.length === 1 ? 'design' : 'designs'}</span>
    </div>
    <form className="shop-search" action="/shop" role="search">
      <label className="sr-only" htmlFor="shop-search">Search products</label>
      <input id="shop-search" type="search" name="q" defaultValue={sp.q || ''} placeholder="Search by design or deity" />
      {sp.category && <input type="hidden" name="category" value={sp.category} />}
      {sp.subject && <input type="hidden" name="subject" value={sp.subject} />}
      <button type="submit" className="btn">Search</button>
    </form>
    <section className="shop-filters" aria-label="Filter products">
      <div className="filter-group">
        <h2>Category</h2>
        <div className="filters">{CATS.map(([n, s]) => <Link key={n} href={link({ category: s, subject: '' })} className={(sp.category || '') === s && !sp.subject ? 'on' : ''} aria-current={(sp.category || '') === s && !sp.subject ? 'page' : undefined}>{n}</Link>)}</div>
      </div>
      {(!sp.category || sp.category === 'god-frames') && <div className="filter-group">
        <h2>Artwork</h2>
        <div className="filters">{GOD_FRAME_SUBJECTS.map(subject => <Link key={subject} href={link({ category: 'god-frames', subject })} className={sp.subject === subject ? 'on' : ''} aria-current={sp.subject === subject ? 'page' : undefined}>{subject}</Link>)}</div>
      </div>}
      {list.some(product => Number.isFinite(product.price)) && <div className="filter-group">
        <h2>Price</h2>
        <div className="filters">{PRICE_RANGES.map(([name, min, max]) => {
          const active = (sp.min || '') === (min || '') && (sp.max || '') === (max || '');
          return <Link key={name} href={link({ min, max })} className={active ? 'on' : ''} aria-current={active ? 'page' : undefined}>{name}</Link>;
        })}</div>
      </div>}
    </section>
    <div className="toolbar">
      <span>{sp.subject ? `Artwork: ${sp.subject}` : 'Browse the catalogue'}</span>
      {(sp.category || sp.subject || sp.min || sp.max || sp.q) && <Link className="clear-filters" href="/shop">Clear search &amp; filters</Link>}
      {list.some(product => Number.isFinite(product.price)) && (
        <div aria-label="Sort products">{[['Featured', ''], ['Price: low to high', 'low'], ['Price: high to low', 'high']].map(([n, s]) => <Link key={n} href={link({ sort: s })} className={(sp.sort || '') === s ? 'on' : ''}>{n}</Link>)}</div>
      )}
    </div>
    {list.length ? <>
      {!list.some(product => product.available !== false && Number.isFinite(product.price) && product.price > 0) && (
        <p className="catalogue-notice">Retail prices and ordering are coming soon. Product pages include available dimensions and finish details.</p>
      )}
      <Reveal className="grid">{list.map((p, index) => <ProductCard key={p.slug} p={p} priority={index < 4} />)}</Reveal>
    </> : <div className="shop-empty"><h2>No designs found</h2><p>Try a different deity or search term, or browse the full catalogue.</p><Link className="btn" href="/shop">Browse all designs</Link></div>}
  </div>);
}
