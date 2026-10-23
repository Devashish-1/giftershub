'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ProductCard from './ProductCard';

const STORAGE_KEY = 'gh-recently-viewed-v1';
const MAX_RECENT_PRODUCTS = 12;

function readRecentlyViewed() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  let parsed;
  try {
    parsed = JSON.parse(stored);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
  if (!Array.isArray(parsed) || parsed.some(slug => typeof slug !== 'string')) {
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
  return parsed.slice(0, MAX_RECENT_PRODUCTS);
}

export function RecentlyViewedTracker({ product }) {
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const slugs = readRecentlyViewed().filter(slug => slug !== product.slug);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([product.slug, ...slugs].slice(0, MAX_RECENT_PRODUCTS)));
    } catch (storageError) {
      setError(storageError.message || 'Recently viewed history could not be saved in this browser.');
    }
  }, [product.slug]);

  return error ? <p className="recently-viewed-error" role="status">{error}</p> : null;
}

export default function RecentlyViewedProducts({ currentSlug }) {
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let isCurrent = true;

    async function loadRecentlyViewed() {
      try {
        const slugs = readRecentlyViewed().filter(slug => slug !== currentSlug);
        if (!slugs.length) {
          if (isCurrent) setProducts([]);
          return;
        }

        const response = await fetch('/api/products', { credentials: 'same-origin', cache: 'no-store' });
        const catalogue = await response.json();
        if (!response.ok || !Array.isArray(catalogue)) {
          throw new Error('Could not load recently viewed products.');
        }
        const bySlug = new Map(catalogue.map(product => [product.slug, product]));
        if (isCurrent) {
          setProducts(slugs.map(slug => bySlug.get(slug)).filter(Boolean).slice(0, 4));
        }
      } catch (loadError) {
        if (isCurrent) setError(loadError.message || 'Could not load recently viewed products.');
      }
    }

    loadRecentlyViewed();
    return () => { isCurrent = false; };
  }, [currentSlug]);

  if (error) {
    return <p className="recently-viewed-error" role="status">{error}</p>;
  }
  if (!products.length) return null;

  return (
    <section className="recently-viewed-section" aria-labelledby="recently-viewed-heading">
      <div className="section-heading">
        <div><span className="eyebrow">Pick up where you left off</span><h2 id="recently-viewed-heading">Recently viewed</h2></div>
        <Link href="/shop">Browse all designs <span aria-hidden="true">→</span></Link>
      </div>
      <div className="grid">{products.map(product => <ProductCard key={product.slug} p={product} />)}</div>
    </section>
  );
}
