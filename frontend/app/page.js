import Link from 'next/link';
import Image from 'next/image';
import { get } from '../lib/api';
import Reveal from '../components/Reveal';
import ProductCard from '../components/ProductCard';
import CategoryCards from '../components/CategoryCards';
import CrystalBubbleShowcase from '../components/CrystalBubbleShowcase';
import HeroSlideshow from '../components/HeroSlideshow';
import HeroMessage from '../components/HeroMessage';
import GoogleReviewsCarousel from '../components/GoogleReviewsCarousel';
import GiftingOccasions from '../components/GiftingOccasions';
import RecentlyViewedProducts from '../components/RecentlyViewedProducts';
import { shopCategoryHref, shopSubjectHref } from '../lib/shop-categories';
import JsonLd from '../components/JsonLd';
import { absoluteUrl, BUSINESS_NAME, DEFAULT_DESCRIPTION } from '../lib/seo';

export const metadata = {
  title: 'Gift Shop in New Delhi | God Frames & Thoughtful Gifts',
  description: DEFAULT_DESCRIPTION,
  alternates: { canonical: '/' },
};

const CATS = [
  { name: 'God Frames', slug: 'god-frames', image: '/products/radha-ka-mohan-radha-krishna-main.webp', note: 'Bring devotion home', action: 'Explore now' },
  { name: 'Family Photo Frames', slug: 'family-frames', image: '/products/heart-family-photo-frame-main.webp', note: 'Keep a memory close', action: 'Discover for more' },
  { name: 'Crystal Bubble', slug: 'crystal-bubble', image: '/products/crystal-bubble-14.webp', note: 'A little sparkle, a lasting keepsake', action: 'See the collection' },
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
    if (!previewProducts.length) previewProducts.push(...products.slice(0, 4));
    return { ...category, images, subcategories, products: previewProducts };
  });
  return (<div className="wrap home-page">
    <JsonLd data={{
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Store',
          '@id': `${absoluteUrl('/')}#store`,
          name: BUSINESS_NAME,
          url: absoluteUrl('/'),
          image: absoluteUrl('/logo-full.png'),
          telephone: '+91 95555 32044',
          address: {
            '@type': 'PostalAddress',
            streetAddress: 'B - 21, Street No. 3, Dichaon Enclave, Kalan, Dichaon Kalan',
            addressLocality: 'New Delhi',
            postalCode: '110043',
            addressCountry: 'IN',
          },
          geo: {
            '@type': 'GeoCoordinates',
            latitude: 28.6297333,
            longitude: 76.996915,
          },
          sameAs: [
            'https://www.instagram.com/thegiftershub/',
            'https://www.facebook.com/p/thegiftershub-61563390688639',
            'https://www.youtube.com/@Thegiftershub-TGH',
            'https://www.google.com/maps/search/?api=1&query=The+Gifter%27s+Hub+Jai+Vihar+New+Delhi',
          ],
        },
        {
          '@type': 'WebSite',
          '@id': `${absoluteUrl('/')}#website`,
          url: absoluteUrl('/'),
          name: BUSINESS_NAME,
          description: DEFAULT_DESCRIPTION,
          publisher: { '@id': `${absoluteUrl('/')}#store` },
          inLanguage: 'en-IN',
          potentialAction: {
            '@type': 'SearchAction',
            target: `${absoluteUrl('/shop')}?q={search_term_string}`,
            'query-input': 'required name=search_term_string',
          },
        },
      ],
    }} />
    <section className="hero">
      <div className="hero-copy">
        <div className="hero-kicker"><span aria-hidden="true">✳</span> Thoughtful finds for meaningful moments</div>
        <div className="eyebrow">Gifts, devotional art &amp; keepsakes</div>
        <HeroMessage />
        <div className="btns">
          <Link className="btn" href="/gifts">Find a gift <span aria-hidden="true">→</span></Link>
          <Link className="btn ghost" href="/shop">Explore the collection</Link>
        </div>
        <div className="hero-caption-row"><span>Made for giving</span><i aria-hidden="true" /><span>Chosen to be remembered</span></div>
      </div>
      <HeroSlideshow />
    </section>

    <div className="home-curation" aria-label="Explore the catalogue">
      <div><span>01</span><b>Devotional art</b><small>Beloved deities, beautifully framed</small></div>
      <div><span>02</span><b>Family keepsakes</b><small>Decorative frames for favourite memories</small></div>
      <div><span>03</span><b>Crystal Bubble</b><small>Discover the signature collection</small></div>
      <Link href="/gifts">Browse by occasion <span aria-hidden="true">↗</span></Link>
    </div>

    <section className="category-section" aria-labelledby="category-heading">
      <div className="section-heading">
        <div><div className="eyebrow">Start with what speaks to you</div><h2 id="category-heading">Find your kind of thoughtful</h2></div>
        <Link href="/shop">Explore everything <span aria-hidden="true">→</span></Link>
      </div>
      <Reveal className="category-showcase"><CategoryCards categories={categories} /></Reveal>
      {categories.find(category => category.slug === 'god-frames')?.subcategories.length > 0 && (
        <div className="deity-browse">
          <span className="eyebrow">Devotional art</span>
          <nav aria-label="Browse god frames by deity">
            {categories.find(category => category.slug === 'god-frames').subcategories.map(subject => (
              <Link key={subject} href={shopSubjectHref('god-frames', subject)}>{subject}</Link>
            ))}
          </nav>
        </div>
      )}
      <CrystalBubbleShowcase products={crystalBubbleProducts} />
    </section>

    <section className="collection-section" aria-labelledby="popular-heading">
      <div className="section-heading">
        <div><div className="eyebrow">From our product catalogue</div><h2 id="popular-heading">Explore the collection</h2></div>
        <Link href="/shop">Browse all frames <span aria-hidden="true">→</span></Link>
      </div>
      <Reveal className="grid">{featured.map(p => <ProductCard key={p.slug} p={p} />)}</Reveal>
    </section>

    <GiftingOccasions products={all} />
    <RecentlyViewedProducts />
    <GoogleReviewsCarousel />

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
        <Link className="text-link" href={shopCategoryHref('god-frames')}>Explore god frames <span aria-hidden="true">→</span></Link>
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
          <Link className="text-link" href={shopCategoryHref('god-frames')}>Browse god frames <span aria-hidden="true">→</span></Link>
        </article>
        <article className="offer-card offer-family">
          <span className="offer-number">02 / MADE FOR GIVING</span>
          <h3>Family photo frames</h3>
          <p>Keep favourite family memories close with the catalogue’s decorative photo-frame design.</p>
          <Link className="text-link" href={shopCategoryHref('family-frames')}>Browse family frames <span aria-hidden="true">→</span></Link>
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

    <div className="store-promise-strip" aria-label="Catalogue information">
      <div><span aria-hidden="true">01</span><b>Real catalogue designs</b><small>Browse the available product photos</small></div>
      <div><span aria-hidden="true">02</span><b>Clear product details</b><small>Check dimensions and finish options</small></div>
      <div><span aria-hidden="true">03</span><b>Need a hand?</b><small><a href="tel:+919555532044">Call +91 95555 32044</a></small></div>
    </div>
  </div>);
}
