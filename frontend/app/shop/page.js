import Image from 'next/image';
import Link from 'next/link';
import ShopProductListing from '../../components/ShopProductListing';
import DeityDirectory from '../../components/DeityDirectory';
import { get } from '../../lib/api';
import { SHOP_CATEGORIES, shopCategoryHref } from '../../lib/shop-categories';
import JsonLd from '../../components/JsonLd';
import { absoluteUrl, BUSINESS_NAME } from '../../lib/seo';

export async function generateMetadata({ searchParams }) {
  const query = await searchParams;
  return {
    title: 'Shop Gift Collections in New Delhi',
    description: 'Browse separate collections of devotional god frames, family photo frames, crystal bubble frames and gifts by occasion.',
    alternates: { canonical: '/shop' },
    openGraph: {
      type: 'website',
      title: 'Shop Gift Collections | The Gifter’s Hub',
      description: 'Browse devotional god frames, family photo frames, crystal bubble frames and gifts by occasion.',
      url: '/shop',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Shop Gift Collections | The Gifter’s Hub',
      description: 'Browse devotional god frames, family photo frames, crystal bubble frames and gifts by occasion.',
    },
    ...(Object.keys(query || {}).length ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function Shop({ searchParams }) {
  const query = await searchParams;
  if (query?.q || query?.occasion || query?.category || query?.subject) {
    return <ShopProductListing searchParams={query} />;
  }

  const products = (await get('/api/products')) || [];
  return (<div className="wrap shop shop-directory">
    <JsonLd data={{
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Shop Gift Collections',
      description: 'Browse gift and frame collections from The Gifter’s Hub.',
      url: absoluteUrl('/shop'),
      isPartOf: { '@type': 'WebSite', name: BUSINESS_NAME, url: absoluteUrl('/') },
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: SHOP_CATEGORIES.map((category, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: category.name,
          url: absoluteUrl(shopCategoryHref(category.slug)),
        })),
      },
    }} />
    <div className="shop-heading">
      <div><span className="eyebrow">THE GIFTERS HUB CATALOGUE</span><h1>Shop by category</h1></div>
      <span className="shop-count">{SHOP_CATEGORIES.length} collections</span>
    </div>
    <p className="shop-category-description">Choose a collection to browse its own dedicated page and product range.</p>
    <div className="shop-category-grid">
      {SHOP_CATEGORIES.map(category => {
        const count = products.filter(product => product.category === category.slug).length;
        return <Link className="shop-category-card" key={category.slug} href={shopCategoryHref(category.slug)}>
          <span className="shop-category-image">
            <Image src={category.image} alt="" fill sizes="(max-width: 650px) 90vw, 33vw" />
          </span>
          <span className="shop-category-card-copy">
            <span className="eyebrow">{count} {count === 1 ? 'design' : 'designs'}</span>
            <strong>{category.name}</strong>
            <span>{category.description}</span>
            <b>Browse collection <span aria-hidden="true">→</span></b>
          </span>
        </Link>;
      })}
    </div>
    <DeityDirectory />
  </div>);
}
