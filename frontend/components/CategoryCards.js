'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { shopCategoryHref, shopSubjectHref } from '../lib/shop-categories';

function CategoryCard({ category, onActivate, onToggle, isOpen }) {
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
          href={shopCategoryHref(slug)}
          aria-label={`${action}: ${name}`}
          onFocus={() => onActivate(slug)}
        >
          {action} <span aria-hidden="true">↗</span>
        </Link>
      </span>
      <b>{name}</b>
      <span className="category-tile-note">{note}</span>
      <button
        className="category-browse-toggle"
        type="button"
        aria-expanded={isOpen}
        aria-controls={isOpen ? `category-preview-${slug}` : undefined}
        onClick={() => onToggle(slug)}
      >
        {isOpen ? 'Hide designs' : category.subcategories.length ? 'Browse by artwork' : 'Browse designs'} <span aria-hidden="true">{isOpen ? '−' : '+'}</span>
      </button>
    </article>
  );
}

function CategoryPreview({ category }) {
  return (
    <div className="category-preview" id={`category-preview-${category.slug}`}>
      <div className="category-subcategories">
        <div className="eyebrow">{category.subcategories.length ? 'Browse by style' : 'Explore collection'}</div>
        <h3>{category.name}</h3>
        {category.subcategories.length
          ? <div className="category-subcategory-list">
            {category.subcategories.map(subject => (
              <Link
                key={subject}
                href={shopSubjectHref(category.slug, subject)}
              >
                {subject} <span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
          : <Link className="category-all-link" href={shopCategoryHref(category.slug)}>View all designs <span aria-hidden="true">→</span></Link>}
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
    <div
      className="category-picker"
      onMouseLeave={() => setActiveSlug(null)}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setActiveSlug(null);
      }}
    >
      <div className="category-tiles">
        {categories.map(category => (
          <CategoryCard
            key={category.slug}
            category={category}
            onActivate={setActiveSlug}
            onToggle={slug => setActiveSlug(current => current === slug ? null : slug)}
            isOpen={activeSlug === category.slug}
          />
        ))}
      </div>
      {activeCategory && (
        <CategoryPreview key={activeCategory.slug} category={activeCategory} />
      )}
    </div>
  );
}
