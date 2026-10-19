import Link from 'next/link';
import { get } from '../lib/api';
import Reveal from '../components/Reveal';
import ProductCard from '../components/ProductCard';
const CATS = [['Gift Hampers', 'gift-hampers', 'G'], ['Idols & Decor', 'idols', 'I'], ['Car Murtis', 'car-murtis', 'C'], ['Malas', 'malas', 'M']];
export default async function Home() {
  const all = (await get('/api/products?sort=rating')) || [];
  return (<div className="wrap">
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow">Gifts &amp; Decor</div>
        <h1>Gifts worth unwrapping.</h1>
        <p>Thoughtful pieces for every festival and every home.</p>
        <div className="btns"><Link className="btn" href="/shop?category=gift-hampers">Shop hampers</Link><Link className="btn ghost" href="/shop">Explore all</Link></div>
      </div>
      <div className="art"><img src="/logo-mark.png" alt="The Gifter’s Hub" /></div>
    </section>
    <Reveal className="cats">{CATS.map(([n, s, i]) => <Link className="cat" data-i={i} key={s} href={`/shop?category=${s}`}><b>{n}</b><span>Shop →</span></Link>)}</Reveal>
    <div className="sec"><h2>Most loved</h2><Link href="/shop">View all</Link></div>
    <Reveal className="grid">{all.slice(0, 4).map(p => <ProductCard key={p.slug} p={p} />)}</Reveal>
    <Reveal className="banner"><div><h2>Make it personal.</h2><p>Gift wrap and a handwritten-style note, added at checkout.</p></div><Link className="btn white" href="/shop?category=gift-hampers">Send a gift</Link></Reveal>
    <div className="strip"><span><b>Free shipping</b> over ₹999</span><span><b>Gift wrap</b> available</span><span><b>Cash on delivery</b></span></div>
  </div>);
}
