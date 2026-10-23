import { notFound } from 'next/navigation';
import Link from 'next/link';
import ShopProductListing from '../../../components/ShopProductListing';
import DeityDirectory from '../../../components/DeityDirectory';
import JsonLd from '../../../components/JsonLd';
import { absoluteUrl, BUSINESS_NAME } from '../../../lib/seo';
import { GOD_FRAME_SUBJECTS } from '../../../lib/catalog';
import { SHOP_CATEGORIES, shopCategoryHref, shopSubjectHref } from '../../../lib/shop-categories';

export async function generateMetadata({ params, searchParams }) {
  const { category: slug } = await params;
  const query = await searchParams;
  if (slug === 'murtis-and-idols') {
    return {
      title: 'Murtis & Idols by Deity | Devotional Gifts',
      description: 'Browse devotional art and god frame designs by deity, including Ganesha, Radha Krishna, Shiva and Sai Baba.',
      alternates: { canonical: shopCategoryHref(slug) },
      openGraph: {
        type: 'website',
        title: 'Murtis & Idols by Deity | The Gifter’s Hub',
        description: 'Browse devotional art and god frame designs by deity, including Ganesha, Radha Krishna, Shiva and Sai Baba.',
        url: shopCategoryHref(slug),
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Murtis & Idols by Deity | The Gifter’s Hub',
        description: 'Browse devotional art and god frame designs by deity, including Ganesha, Radha Krishna, Shiva and Sai Baba.',
      },
    };
  }
  const category = SHOP_CATEGORIES.find(item => item.slug === slug);
  if (!category) return { title: 'Collection not found', robots: { index: false, follow: false } };
  return {
    title: `${category.name} | Shop the Collection`,
    description: category.description,
    alternates: { canonical: shopCategoryHref(slug) },
    openGraph: {
      type: 'website',
      title: `${category.name} | The Gifter’s Hub`,
      description: category.description,
      url: shopCategoryHref(slug),
      images: [{ url: category.image, alt: category.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${category.name} | The Gifter’s Hub`,
      description: category.description,
      images: [category.image],
    },
    ...(Object.keys(query || {}).length ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function ShopCategory({ params, searchParams }) {
  const { category } = await params;
  const query = await searchParams;
  if (category === 'murtis-and-idols') {
    return <div className="wrap shop">
      <nav className="product-breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span><Link href="/shop">Shop</Link><span aria-hidden="true">/</span><span aria-current="page">Murtis &amp; Idols</span></nav>
      <div className="shop-heading"><div><span className="eyebrow">DEVOTIONAL COLLECTION</span><h1>Murtis &amp; Idols</h1></div></div>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Murtis & Idols by Deity',
        description: 'Browse devotional art and god frame designs by deity.',
        url: absoluteUrl(shopCategoryHref(category)),
        isPartOf: { '@type': 'WebSite', name: BUSINESS_NAME, url: absoluteUrl('/') },
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: GOD_FRAME_SUBJECTS.map((subject, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: subject,
            url: absoluteUrl(shopSubjectHref('god-frames', subject)),
          })),
        },
      }} />
      <DeityDirectory />
    </div>;
  }
  if (!SHOP_CATEGORIES.some(item => item.slug === category)) notFound();
  return <ShopProductListing category={category} searchParams={query} />;
}
