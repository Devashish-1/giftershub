import Link from 'next/link';
import { get } from '../lib/api';
import Reveal from '../components/Reveal';
import ProductCard from '../components/ProductCard';

const CATS = [
  { name: 'Gift Hampers', slug: 'gift-hampers', image: 'diwali-hamper-premium', note: 'Make their moment' },
  { name: 'Idols & Decor', slug: 'idols', image: 'shiva-trishul-damru-idol', note: 'Bring meaning home' },
  { name: 'Car Murtis', slug: 'car-murtis', image: 'ganesha-dashboard-murti', note: 'A blessing on the go' },
  { name: 'Photo Frames', slug: 'photo-frames', image: 'ganesha-bubble-crystal-photoframe', note: 'Make a memory shine' },
];

export default async function Home() {
  const all = (await get('/api/products?sort=rating')) || [];
  const featured = all.filter(p => p.category !== 'photo-frames').slice(0, 2)
    .concat(all.filter(p => p.category === 'photo-frames').slice(0, 2));
  return (<div className="wrap">
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow">For rituals, homes &amp; heartfelt giving</div>
        <h1>Give a little <em>meaning.</em></h1>
        <p>Thoughtful murtis, crystal photo frames and festive gifts for the moments that bring us together.</p>
        <div className="btns"><Link className="btn" href="/shop?category=gift-hampers">Find a thoughtful gift</Link><Link className="btn ghost" href="/shop">Explore the collection</Link></div>
      </div>
      <div className="art">
        <img className="hero-main" src="/products/ganesha-bubble-crystal-photoframe.jpg" alt="The Gifters Hub Bubble Crystal Ganesha Photoframe" />
        <div className="hero-photo-note"><span>Made for meaningful moments</span><b>A little joy, beautifully shared</b></div>
        <div className="hero-seal" aria-hidden="true">With<br />love</div>
      </div>
    </section>

    <section className="category-section" aria-labelledby="category-heading">
      <div className="section-heading">
        <div><div className="eyebrow">Find your something special</div><h2 id="category-heading">Shop by collection</h2></div>
        <Link href="/shop">Explore everything <span aria-hidden="true">→</span></Link>
      </div>
      <Reveal className="cats">{CATS.map(({ name, slug, image, note }) => <Link className="cat" key={slug} href={`/shop?category=${slug}`}>
        <img src={`/products/${image}.jpg`} alt="" loading="lazy" />
        <span className="cat-shade" />
        <span className="cat-copy"><small>{note}</small><b>{name}</b><span className="cat-link">Discover <span aria-hidden="true">↗</span></span></span>
      </Link>)}</Reveal>
    </section>

    <section className="collection-section" aria-labelledby="popular-heading">
      <div className="section-heading">
        <div><div className="eyebrow">Customer favourites and new listings</div><h2 id="popular-heading">A few much-loved finds</h2></div>
        <Link href="/shop?sort=rating">Shop all favourites <span aria-hidden="true">→</span></Link>
      </div>
      <Reveal className="grid">{featured.map(p => <ProductCard key={p.slug} p={p} />)}</Reveal>
    </section>

    <Reveal className="story">
      <div className="story-art">
        <img className="story-main" src="/products/ganesha-bubble-crystal-photoframe.jpg" alt="Glossy devotional photo frame with Lord Ganesha" loading="lazy" />
        <img className="story-detail" src="/products/lakshmi-ganesh-pair.jpg" alt="" loading="lazy" />
        <span className="story-caption">Little details. A lot of heart.</span>
      </div>
      <div className="story-copy">
        <div className="eyebrow">A gift that feels like you</div>
        <h2>Make the moment more personal.</h2>
        <p>Choose something meaningful, then add gift wrap and a greeting card at checkout. A thoughtful touch for celebrations, new beginnings and just-because days.</p>
        <Link className="text-link" href="/shop?category=gift-hampers">Explore gifts <span aria-hidden="true">→</span></Link>
        <div className="story-points"><span><b>01</b> Find a favourite</span><span><b>02</b> Add a personal touch</span><span><b>03</b> Make it memorable</span></div>
      </div>
    </Reveal>

    <section className="offer-section" aria-labelledby="offer-heading">
      <div className="section-heading">
        <div><div className="eyebrow">More ways to make it yours</div><h2 id="offer-heading">Gifts with a personal touch</h2></div>
      </div>
      <Reveal className="offer-grid">
        <article className="offer-card offer-crystal">
          <span className="offer-number">01 / KEEP A MEMORY CLOSE</span>
          <h3>Crystal &amp; light frames</h3>
          <p>Turn a favourite photo into a glowing keepsake. Ask us about personalised designs and wholesale options.</p>
          <a className="text-link" href="https://www.instagram.com/thegiftershub/" target="_blank" rel="noreferrer">Ask us on Instagram <span aria-hidden="true">↗</span></a>
        </article>
        <article className="offer-card offer-family">
          <span className="offer-number">02 / MADE FOR GIVING</span>
          <h3>Divine idols &amp; family portraits</h3>
          <p>Explore meaningful pieces for your home, celebrations and the people you love.</p>
          <Link className="text-link" href="/shop?category=idols">Browse idols <span aria-hidden="true">→</span></Link>
        </article>
        <article className="offer-card offer-wholesale">
          <span className="offer-number">03 / GIFTING AT YOUR SCALE</span>
          <h3>Looking for wholesale?</h3>
          <p>Request the wholesale catalogue directly. Pan-India delivery is available; message us for product and delivery details.</p>
          <a className="text-link" href="https://www.instagram.com/thegiftershub/" target="_blank" rel="noreferrer">Request the catalogue <span aria-hidden="true">↗</span></a>
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
        <details><summary>How do I choose a thoughtful gift?</summary><p>Browse by collection and occasion, then check each listing for materials, dimensions and care details. If you need help choosing, call us or send a message on Instagram.</p></details>
        <details><summary>Can you help with a personalised gift?</summary><p>Yes. The Gifter’s Hub features bubble crystal and light frames, divine idols and family portraits. Message us to discuss designs and availability.</p></details>
        <details><summary>Do you deliver across India?</summary><p>Pan-India delivery is listed on our Instagram profile. Message or call us to confirm delivery options for your pin code and item.</p></details>
        <details><summary>How does gift wrapping work?</summary><p>Add gift wrap and a greeting card at checkout. For wholesale or custom requests, contact us directly.</p></details>
      </div>
    </section>

    <div className="strip"><span><b>Free shipping</b> over ₹999</span><span><b>Gift wrap</b> and greeting card available</span><span><b>Cash on delivery</b> available</span></div>
  </div>);
}
