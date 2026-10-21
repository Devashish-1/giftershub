'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

function CategoryCard({ category, onActivate }) {
  const { name, slug, image, images, note, action } = category;
  const [currentImage, setCurrentImage] = useState(image);

  useEffect(() => {
    if (images.length < 2) return undefined;

    const interval = window.setInterval(() => {
      setCurrentImage(current => {
        const nextImages = images.filter(candidate => candidate !== current);
        return nextImages[Math.floor(Math.random() * nextImages.length)];
      });
    }, 3000);

    return () => window.clearInterval(interval);
  }, [images]);

  return (
    <article className="category-tile" onMouseEnter={() => onActivate(slug)}>
      <span className="category-tile-image">
        <span className="category-image-enter" key={currentImage}>
          <Image src={currentImage} alt="" fill sizes="(max-width: 520px) 128px, 160px" />
        </span>
        <Link
          className="category-tile-cta"
          href={`/shop?category=${slug}`}
          aria-label={`${action}: ${name}`}
          onFocus={() => onActivate(slug)}
        >
          {action} <span aria-hidden="true">↗</span>
        </Link>
      </span>
      <b>{name}</b>
      <span className="category-tile-note">{note}</span>
    </article>
  );
}

function CategoryPreview({ category }) {
  return (
    <div className="category-preview">
      <div className="category-subcategories">
        <div className="eyebrow">Browse by style</div>
        <h3>{category.name}</h3>
        <div className="category-subcategory-list">
          {category.subcategories.map(subject => (
            <Link
              key={subject}
              href={`/shop?category=${category.slug}&subject=${encodeURIComponent(subject)}`}
            >
              {subject} <span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </div>
      <div className="category-product-preview">
        {category.products.map(product => (
          <Link className="category-product" key={product.slug} href={`/product/${product.slug}`}>
            <span className="category-product-image">
              <Image src={product.image} alt="" fill sizes="(max-width: 600px) 38vw, 180px" />
            </span>
            <span>{product.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function CategoryCards({ categories }) {
  const [activeSlug, setActiveSlug] = useState(null);
  const activeCategory = categories.find(category => category.slug === activeSlug);

  return (
    <div className="category-picker" onMouseLeave={() => setActiveSlug(null)}>
      <div className="category-tiles">
        {categories.map(category => (
          <CategoryCard key={category.slug} category={category} onActivate={setActiveSlug} />
        ))}
      </div>
      {activeCategory && (
        <CategoryPreview key={activeCategory.slug} category={activeCategory} />
      )}
    </div>
  );
}
