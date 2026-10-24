import Link from 'next/link';
import { get } from '../../lib/api';
import GiftingOccasions from '../../components/GiftingOccasions';
import ProductCard from '../../components/ProductCard';
import RecentlyViewedProducts from '../../components/RecentlyViewedProducts';

export const metadata = {
  title: 'Gift Ideas by Occasion | Diwali, Rakhi, Weddings & Housewarming',
  description: 'Browse gift ideas from The Gifter’s Hub catalogue for Diwali, Rakhi, weddings and housewarming.',
  alternates: { canonical: '/gifts' },
  openGraph: {
    type: 'website',
    title: 'Gift Ideas by Occasion | The Gifter’s Hub',
    description: 'Browse curated catalogue ideas for Diwali, Rakhi, weddings and housewarming.',
    url: '/gifts',
  },
};

export default async function GiftsPage() {
  const products = (await get('/api/products')) || [];
  const popularProducts = [
    products.find(product => product.category === 'god-frames' && product.subject === 'Ganesha'),
    products.find(product => product.category === 'family-frames'),
    products.find(product => product.category === 'god-frames' && product.subject === 'Radha Krishna'),
    products.find(product => product.category === 'crystal-bubble'),
  ].filter((product, index, selected) =>
    product && selected.findIndex(candidate => candidate?.slug === product.slug) === index);

  return (
    <div className="wrap gifts-page">
      <section className="gifts-page-heading">
        <span className="eyebrow">THOUGHTFUL GIFT IDEAS</span>
        <h1>Find a gift for the moment.</h1>
        <p>Browse occasion-led ideas selected from our current frame catalogue.</p>
        <Link className="text-link" href="/shop">Explore the full catalogue <span aria-hidden="true">→</span></Link>
      </section>
      <GiftingOccasions products={products} />
      {popularProducts.length > 0 && <section className="gifts-product-section" aria-labelledby="gifts-popular-heading">
        <div className="section-heading">
          <div><span className="eyebrow">A few places to start</span><h2 id="gifts-popular-heading">Popular gift designs</h2></div>
          <Link href="/shop">Browse all designs <span aria-hidden="true">→</span></Link>
        </div>
        <div className="grid">{popularProducts.map(product => <ProductCard key={product.slug} p={product} />)}</div>
      </section>}
      <RecentlyViewedProducts />
    </div>
  );
}
