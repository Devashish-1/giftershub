import Link from 'next/link';
import { get } from '../../lib/api';
import Reveal from '../../components/Reveal';
import ProductCard from '../../components/ProductCard';
const CATS = [['All', ''], ['Malas & Bracelets', 'malas'], ['Car Murtis', 'car-murtis'], ['Idols', 'idols'], ['Pooja Essentials', 'pooja'], ['Gift Hampers', 'gift-hampers']];
export default async function Shop({ searchParams: sp }) {
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v)).toString();
  const list = (await get('/api/products?' + qs)) || [];
  const link = (o) => '/shop?' + new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([, v]) => v)).toString();
  const title = CATS.find(c => c[1] === (sp.category || ''))?.[0];
  return (<div className="wrap shop">
    <h1>{sp.q ? `Results for “${sp.q}”` : title === 'All' ? 'Shop all' : title}</h1>
    <div className="filters">{CATS.map(([n, s]) => <Link key={n} href={link({ category: s })} className={(sp.category || '') === s ? 'on' : ''}>{n}</Link>)}</div>
    <div className="toolbar"><span>{list.length} items</span>
      <div>{[['Popular', ''], ['Price: low', 'low'], ['Price: high', 'high'], ['Top rated', 'rating']].map(([n, s]) => <Link key={n} href={link({ sort: s })} className={(sp.sort || '') === s ? 'on' : ''}>{n}</Link>)}</div></div>
    {list.length ? <Reveal className="grid">{list.map(p => <ProductCard key={p.slug} p={p} />)}</Reveal> : <p>No matches. Try another search.</p>}
  </div>);
}
