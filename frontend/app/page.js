import Link from 'next/link';
import Image from 'next/image';
import { get } from '../lib/api';
import Reveal from '../components/Reveal';
import ProductCard from '../components/ProductCard';
import CategoryCards from '../components/CategoryCards';
import CrystalBubbleShowcase from '../components/CrystalBubbleShowcase';
import HeroSlideshow from '../components/HeroSlideshow';

const CATS = [
  { name: 'God Frames', slug: 'god-frames', image: '/products/radha-ka-mohan-radha-krishna-main.webp', note: 'Bring devotion home', action: 'Explore now' },
  { name: 'Family Photo Frames', slug: 'family-frames', image: '/products/heart-family-photo-frame-main.webp', note: 'Keep a memory close', action: 'Discover for more' },
];

export default async function Home() {
  const all = (await get('/api/products')) || [];
  const featured = all.filter(p => p.category === 'god-frames').slice(0, 3)
    .concat(all.filter(p => p.category === 'family-frames').slice(0, 1));
  const crystalBubbleProducts = all.filter(product => product.category === 'crystal-bubble');
  const categories = CATS.map(category => {
    const products = all.filter(product => product.category === category.slug);
    const images = [...new Set(products
      .flatMap(product => product.gallery?.length ? product.gallery : [product.image])
      .filter(Boolean))];
    if (!images.includes(category.image)) images.unshift(category.image);
    const subcategories = [...new Set(products.map(product => product.subject).filter(Boolean))]
      .sort((first, second) => first.localeCompare(second));
    const previewProducts = subcategories
      .map(subject => products.find(product => product.subject === subject))
      .filter(Boolean)
      .slice(0, 4);
    return { ...category, images, subcategories, products: previewProducts };
  });
  return (<div className="wrap home-page">
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow">Crystal bubble art &amp; meaningful keepsakes</div>
        <h1>Give a little <em>meaning.</em></h1>
        <p>Discover crystal bubble frames, devotional art, and family keepsakes from The Gifter’s Hub catalogue.</p>
        <div className="btns"><Link className="btn" href="/shop?category=god-frames">Browse god frames</Link><Link className="btn ghost" href="/shop">Explore the collection</Link></div>
      </div>
      <HeroSlideshow />
    </section>

    <section className="category-section" aria-labelledby="category-heading">
      <div className="section-heading">
        <div><div className="eyebrow">Find your something special</div><h2 id="category-heading">Explore our categories</h2></div>
        <Link href="/shop">Explore everything <span aria-hidden="true">→</span></Link>
      </div>
      <Reveal className="category-showcase"><CategoryCards categories={categories} /></Reveal>
      <CrystalBubbleShowcase products={crystalBubbleProducts} />
    </section>

    <section className="collection-section" aria-labelledby="popular-heading">
      <div className="section-heading">
        <div><div className="eyebrow">From our product catalogue</div><h2 id="popular-heading">Explore the collection</h2></div>
        <Link href="/shop">Browse all frames <span aria-hidden="true">→</span></Link>
      </div>
      <Reveal className="grid">{featured.map(p => <ProductCard key={p.slug} p={p} />)}</Reveal>
    </section>

    <Reveal className="story">
      <div className="story-art">
        <Image className="story-main" src="/products/crystal-bubble-14.webp" alt="Crystal Bubble Frame 14" width={1024} height={1009} sizes="(max-width: 900px) 90vw, 42vw" />
        <Image className="story-detail" src="/products/crystal-bubble-15.webp" alt="Crystal Bubble Frame 15" width={1024} height={420} sizes="(max-width: 900px) 32vw, 15vw" />
        <span className="story-caption">Little details. A lot of heart.</span>
      </div>
      <div className="story-copy">
        <div className="eyebrow">Inspired by our catalogue</div>
        <h2>Art for meaningful spaces.</h2>
        <p>Browse devotional scenes and family keepsakes, with catalogue dimensions and finish details shown on each product page.</p>
        <Link className="text-link" href="/shop?category=god-frames">Explore god frames <span aria-hidden="true">→</span></Link>
        <div className="story-points"><span><b>01</b> Browse the designs</span><span><b>02</b> Check the dimensions</span><span><b>03</b> Choose your favourite</span></div>
      </div>
    </Reveal>

    <section className="offer-section" aria-labelledby="offer-heading">
      <div className="section-heading">
        <div><div className="eyebrow">Browse by style</div><h2 id="offer-heading">Frames for meaningful moments</h2></div>
      </div>
      <Reveal className="offer-grid">
        <article className="offer-card offer-crystal">
          <span className="offer-number">01 / KEEP A MEMORY CLOSE</span>
          <h3>Devotional wall frames</h3>
          <p>Explore catalogue designs featuring beloved deities, with listed dimensions and finish options on each product page.</p>
          <Link className="text-link" href="/shop?category=god-frames">Browse god frames <span aria-hidden="true">→</span></Link>
        </article>
        <article className="offer-card offer-family">
          <span className="offer-number">02 / MADE FOR GIVING</span>
          <h3>Family photo frames</h3>
          <p>Keep favourite family memories close with the catalogue’s decorative photo-frame design.</p>
          <Link className="text-link" href="/shop?category=family-frames">Browse family frames <span aria-hidden="true">→</span></Link>
        </article>
      </Reveal>
    </section>

    <section className="guide-section" aria-labelledby="guide-heading">
      <div className="guide-intro">
        <div className="eyebrow">A little help before you choose</div>
        <h2 id="guide-heading">Good to know</h2>
        <p>Need a hand choosing a gift or checking a product detail? Here are a few useful starting points.</p>
        <a className="text-link" href="tel:+919555532044">Call us: +91 95555 32044 <span aria-hidden="true">↗</span></a>
      </div>
      <div className="guide-faq">
        <details><summary>How do I choose a frame?</summary><p>Browse the catalogue, then check the model, artwork, dimensions, and listed finish details on each product page.</p></details>
        <details><summary>Are the products ready to order?</summary><p>The catalogue is being added for retail. Prices and ordering will become available after retail pricing is confirmed.</p></details>
        <details><summary>Can I ask about a design?</summary><p>Yes. Call The Gifter’s Hub at +91 95555 32044 for questions about a product shown in the catalogue.</p></details>
      </div>
    </section>

    <div className="strip"><span><b>66 catalogue designs</b></span><span><b>Retail prices</b> coming soon</span><span><b>Browse details</b> and catalogue images</span></div>
  </div>);
}
