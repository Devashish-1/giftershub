import Link from 'next/link';
import { get } from '../../lib/api';
import GiftingOccasions from '../../components/GiftingOccasions';
import ProductCard from '../../components/ProductCard';
import { GIFT_OCCASIONS } from '../../lib/gifting';
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

  return (
    <div className="wrap gifts-page">
      <section className="gifts-page-heading">
        <span className="eyebrow">THOUGHTFUL GIFT IDEAS</span>
        <h1>Find a gift for the moment.</h1>
        <p>Browse occasion-led ideas selected from our current frame catalogue.</p>
        <Link className="text-link" href="/shop">Explore the full catalogue <span aria-hidden="true">→</span></Link>
      </section>
      <GiftingOccasions products={products} />
      {GIFT_OCCASIONS.map(occasion => {
        const selectedProducts = products
          .filter(product => product.category === occasion.category && product.subject === occasion.subject)
          .slice(0, 4);
        if (!selectedProducts.length) return null;

        return (
          <section className="gifts-product-section" key={occasion.slug} aria-labelledby={`gift-${occasion.slug}`}>
            <div className="section-heading">
              <div><span className="eyebrow">{occasion.title.toUpperCase()}</span><h2 id={`gift-${occasion.slug}`}>{occasion.heading}</h2></div>
              <Link href={`/shop?occasion=${occasion.slug}`}>Browse collection <span aria-hidden="true">→</span></Link>
            </div>
            <div className="grid">{selectedProducts.map(product => <ProductCard key={product.slug} p={product} />)}</div>
          </section>
        );
      })}
      <RecentlyViewedProducts />
    </div>
  );
}
