import Link from 'next/link';
import { get } from '../../lib/api';
import Reveal from '../../components/Reveal';
import ProductCard from '../../components/ProductCard';
const CATS = [['All', ''], ['God Frames', 'god-frames'], ['Family Photo Frames', 'family-frames'], ['Crystal Bubble Frames', 'crystal-bubble']];
const SUBJECTS = ['Radha Krishna', 'Ganesha', 'Ram Darbar', 'Ram and Sita', 'Ram Mandir', 'Shiva', 'Sai Baba'];
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
    : CATS.find(c => c[1] === (sp.category || ''))?.[0];
  return (<div className="wrap shop">
    <h1>{sp.q ? `Results for “${sp.q}”` : title === 'All' ? 'Shop all' : title}</h1>
    <section className="shop-filters" aria-label="Filter products">
      <div className="filter-group">
        <h2>Category</h2>
        <div className="filters">{CATS.map(([n, s]) => <Link key={n} href={link({ category: s, subject: '' })} className={(sp.category || '') === s && !sp.subject ? 'on' : ''} aria-current={(sp.category || '') === s && !sp.subject ? 'page' : undefined}>{n}</Link>)}</div>
      </div>
      {(!sp.category || sp.category === 'god-frames') && <div className="filter-group">
        <h2>Artwork</h2>
        <div className="filters">{SUBJECTS.map(subject => <Link key={subject} href={link({ category: 'god-frames', subject })} className={sp.subject === subject ? 'on' : ''} aria-current={sp.subject === subject ? 'page' : undefined}>{subject}</Link>)}</div>
      </div>}
      {list.some(product => Number.isFinite(product.price)) && <div className="filter-group">
        <h2>Price</h2>
        <div className="filters">{PRICE_RANGES.map(([name, min, max]) => {
          const active = (sp.min || '') === (min || '') && (sp.max || '') === (max || '');
          return <Link key={name} href={link({ min, max })} className={active ? 'on' : ''} aria-current={active ? 'page' : undefined}>{name}</Link>;
        })}</div>
      </div>}
    </section>
    <div className="toolbar"><span>{list.length} items</span>
      <div>{[['Popular', ''], ['Price: low', 'low'], ['Price: high', 'high'], ['Top rated', 'rating']].map(([n, s]) => <Link key={n} href={link({ sort: s })} className={(sp.sort || '') === s ? 'on' : ''}>{n}</Link>)}</div></div>
    {list.length ? <Reveal className="grid">{list.map((p, index) => <ProductCard key={p.slug} p={p} priority={index < 4} />)}</Reveal> : <p>No matches. Try another search.</p>}
  </div>);
}
