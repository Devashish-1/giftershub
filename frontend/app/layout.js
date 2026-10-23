import './globals.css';
import CartProvider from '../components/CartProvider';
import AuthProvider from '../components/AuthProvider';
import Shell from '../components/Shell';
import Cursor from '../components/Cursor';
import { BUSINESS_NAME, DEFAULT_DESCRIPTION, DEFAULT_SOCIAL_IMAGE, SITE_URL } from '../lib/seo';

export const metadata = {
  metadataBase: new URL(`${SITE_URL}/`),
  title: {
    default: `${BUSINESS_NAME} | Gifts & Decor in New Delhi`,
    template: `%s | ${BUSINESS_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: BUSINESS_NAME,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    siteName: BUSINESS_NAME,
    title: `${BUSINESS_NAME} | Gifts & Decor in New Delhi`,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    images: [{ url: DEFAULT_SOCIAL_IMAGE, alt: `${BUSINESS_NAME} gifts and decor` }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${BUSINESS_NAME} | Gifts & Decor in New Delhi`,
    description: DEFAULT_DESCRIPTION,
    images: [DEFAULT_SOCIAL_IMAGE],
  },
  keywords: ['gift shop New Delhi', 'god frames', 'devotional wall frames', 'crystal bubble frames', 'family photo frames', 'gift ideas India'],
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
};
export default function RootLayout({ children }) {
  return (<html lang="en"><head>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
  </head><body><AuthProvider><CartProvider><Cursor /><Shell>{children}</Shell></CartProvider></AuthProvider></body></html>);
}
