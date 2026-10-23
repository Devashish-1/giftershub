export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://giftershub.vercel.app').replace(/\/+$/, '');
export const BUSINESS_NAME = 'The Gifter’s Hub';
export const DEFAULT_DESCRIPTION = 'Shop devotional god frames, crystal bubble frames, family photo frames and thoughtful gifts from The Gifter’s Hub in New Delhi.';
export const DEFAULT_SOCIAL_IMAGE = '/logo-full.png';

export function absoluteUrl(path = '/') {
  return new URL(path, `${SITE_URL}/`).toString();
}

export function productDescription(product) {
  const description = String(product.desc || `${product.name} from The Gifter’s Hub.`).trim();
  return description.length > 160 ? `${description.slice(0, 157).trimEnd()}...` : description;
}

export function jsonLd(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
