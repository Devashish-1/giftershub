import { GOD_FRAME_SUBJECTS } from './catalog';

export const SHOP_CATEGORIES = [
  {
    slug: 'god-frames',
    name: 'God Frames',
    description: 'Devotional artwork featuring beloved gods and spiritual scenes.',
    image: '/products/radha-ka-mohan-radha-krishna-main.webp',
  },
  {
    slug: 'family-frames',
    name: 'Family Photo Frames',
    description: 'Decorative frames for the family memories you want to keep close.',
    image: '/products/heart-family-photo-frame-main.webp',
  },
  {
    slug: 'crystal-bubble',
    name: 'Crystal Bubble Frames',
    description: 'Explore the distinctive crystal bubble frame collection.',
    image: '/products/crystal-bubble-14.webp',
  },
];

export function shopCategoryHref(category) {
  return `/shop/${category}`;
}

export function shopSubjectSlug(subject) {
  return subject.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function shopSubjectHref(category, subject) {
  return `${shopCategoryHref(category)}/${shopSubjectSlug(subject)}`;
}

export function getShopSubject(category, slug) {
  if (category === 'god-frames') {
    return GOD_FRAME_SUBJECTS.find(subject => shopSubjectSlug(subject) === slug) || null;
  }
  if (category === 'family-frames' && slug === 'family') return 'Family';
  return null;
}
