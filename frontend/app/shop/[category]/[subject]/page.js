import { notFound } from 'next/navigation';
import ShopProductListing from '../../../../components/ShopProductListing';
import { getShopSubject, SHOP_CATEGORIES, shopSubjectHref } from '../../../../lib/shop-categories';

export async function generateMetadata({ params, searchParams }) {
  const { category, subject: subjectSlug } = await params;
  const subject = getShopSubject(category, subjectSlug);
  if (!subject) return { title: 'Collection not found', robots: { index: false, follow: false } };
  const query = await searchParams;
  const title = `${subject} Frames & Devotional Art`;
  const categoryDetails = SHOP_CATEGORIES.find(item => item.slug === category);
  return {
    title,
    description: `Browse ${subject} devotional frame designs from The Gifter’s Hub catalogue in New Delhi.`,
    alternates: { canonical: shopSubjectHref(category, subject) },
    openGraph: {
      type: 'website',
      title: `${title} | The Gifter’s Hub`,
      description: `Explore ${subject} designs from The Gifter’s Hub.`,
      url: shopSubjectHref(category, subject),
      ...(categoryDetails ? { images: [{ url: categoryDetails.image, alt: `${subject} frames` }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | The Gifter’s Hub`,
      description: `Explore ${subject} designs from The Gifter’s Hub.`,
      ...(categoryDetails ? { images: [categoryDetails.image] } : {}),
    },
    ...(Object.keys(query || {}).length ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function ShopSubject({ params, searchParams }) {
  const { category, subject: subjectSlug } = await params;
  const query = await searchParams;
  const subject = getShopSubject(category, subjectSlug);
  if (!subject) notFound();
  return <ShopProductListing category={category} subject={subject} searchParams={query} />;
}
