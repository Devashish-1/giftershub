import { get } from '../lib/api';
import { GOD_FRAME_SUBJECTS } from '../lib/catalog';
import { SHOP_CATEGORIES, shopCategoryHref, shopSubjectHref } from '../lib/shop-categories';
import { absoluteUrl } from '../lib/seo';

const STATIC_ROUTES = [
  '/',
  '/shop',
  '/gifts',
  '/terms',
  '/privacy',
  ...SHOP_CATEGORIES.map(category => shopCategoryHref(category.slug)),
  '/shop/murtis-and-idols',
  ...GOD_FRAME_SUBJECTS.map(subject => shopSubjectHref('god-frames', subject)),
  shopSubjectHref('family-frames', 'Family'),
];

export default async function sitemap() {
  const products = (await get('/api/products')) || [];
  const staticEntries = STATIC_ROUTES.map(route => ({
    url: absoluteUrl(route),
    changeFrequency: route === '/' ? 'weekly' : 'monthly',
    priority: route === '/' ? 1 : route === '/shop' || route === '/gifts' ? 0.8 : 0.6,
  }));
  const productEntries = products.map(product => ({
    url: absoluteUrl(`/product/${encodeURIComponent(product.slug)}`),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));
  return [...staticEntries, ...productEntries];
}
