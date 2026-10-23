import { notFound } from 'next/navigation';
import Link from 'next/link';
import { get, inr } from '../../../lib/api';
import Zoom from '../../../components/Zoom';
import Reveal from '../../../components/Reveal';
import Buy from './Buy';
import ProductCard from '../../../components/ProductCard';
export default async function PDP({ params }) {
  const p = await get('/api/products/' + params.slug); if (!p) notFound();
  const off = Number.isFinite(p.price) && Number.isFinite(p.mrp) && p.mrp > p.price
    ? Math.round((1 - p.price / p.mrp) * 100)
    : 0;
  return (<div className="wrap">
    <nav className="product-breadcrumbs" aria-label="Breadcrumb">
      <Link href="/">Home</Link><span aria-hidden="true">/</span>
      <Link href={`/shop?category=${encodeURIComponent(p.category)}`}>{p.category.replaceAll('-', ' ')}</Link>
      {p.subject && <><span aria-hidden="true">/</span><Link href={`/shop?category=${encodeURIComponent(p.category)}&subject=${encodeURIComponent(p.subject)}`}>{p.subject}</Link></>}
      <span aria-hidden="true">/</span><span aria-current="page">{p.name}</span>
    </nav>
    <div className="pdp">
      <Zoom slug={p.slug} name={p.name} image={p.image} gallery={p.gallery} />
      <div>
        <div className="lbl">{p.category.replace('-', ' ')}</div>
        <h1 style={{ marginTop: 8 }}>{p.name}</h1>
        {p.available !== false && Number.isFinite(p.price) && <div className="pr"><b>{inr(p.price)}</b>{Number.isFinite(p.mrp) && <s>{inr(p.mrp)}</s>}{off > 0 && <em>{off}% off</em>}</div>}
        <p className="lead">{p.desc}</p>
        {p.sourceUrl && <p className="marketplace-note">{p.availabilityNote || 'Demo listing; price and availability may change.'} <a href={p.sourceUrl} target="_blank" rel="noreferrer">Check the current {p.sourceName || 'marketplace'} listing ↗</a></p>}
        {p.details && <section className="product-details" aria-label="Product details">
          <h2>Product details</h2>
          <dl>{Object.entries(p.details).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        </section>}
        <aside className="product-help">
          <span className="eyebrow">Need help choosing?</span>
          <p>Ask us about this design or its product details.</p>
          <div><a href="tel:+919555532044">Call +91 95555 32044</a><a href="https://wa.me/919555532044" target="_blank" rel="noreferrer">WhatsApp ↗</a></div>
        </aside>
        {p.stock !== null && p.stock < 20 && <div className="bad" style={{ marginBottom: 12 }}>Only {p.stock} left</div>}
        <Buy p={p} />
        <div className="acc">
          <details><summary>Care &amp; product information</summary><p>For care guidance or additional information about this design, please contact The Gifter’s Hub.</p></details>
          <details><summary>Ordering, delivery &amp; returns</summary><p>Retail prices and ordering details will be confirmed before this item becomes available to purchase. <Link href="/terms">Read our delivery, cancellation and return terms.</Link></p></details>
        </div>
      </div>
    </div>
    {p.related?.length > 0 && <><div className="sec"><h2>More from this collection</h2></div>
      <Reveal className="grid">{p.related.map(r => <ProductCard key={r.slug} p={r} />)}</Reveal>
    </>}
  </div>);
}
