import Link from 'next/link';
import Reveal from './Reveal';
import ProductCard from './ProductCard';
import RecentlyViewedProducts from './RecentlyViewedProducts';
import { GOD_FRAME_SUBJECTS } from '../lib/catalog';
import { GIFT_OCCASIONS } from '../lib/gifting';
import { get } from '../lib/api';
import { getShopSubject, SHOP_CATEGORIES, shopCategoryHref, shopSubjectHref } from '../lib/shop-categories';
import JsonLd from './JsonLd';
import { absoluteUrl, BUSINESS_NAME } from '../lib/seo';

const PRICE_RANGES = [
  ['Any price', null, null],
  ['Under ₹500', null, '499'],
  ['₹500 – ₹999', '500', '999'],
  ['₹1,000 – ₹1,999', '1000', '1999'],
  ['₹2,000+', '2000', null],
];

export default async function ShopProductListing({ category = '', subject = '', searchParams = {} }) {
  const occasion = GIFT_OCCASIONS.find(item => item.slug === searchParams.occasion);
  const activeCategory = category || searchParams.category || occasion?.category || '';
  const activeSubject = subject || searchParams.subject || occasion?.subject || '';
  const query = {
    ...Object.fromEntries(Object.entries(searchParams).filter(([key, value]) =>
      ['q', 'sort', 'min', 'max'].includes(key) && value)),
    ...(activeCategory ? { category: activeCategory } : {}),
    ...(activeSubject ? { subject: activeSubject } : {}),
  };
  const list = (await get('/api/products?' + new URLSearchParams(query).toString())) || [];
  const activeCategoryDetails = SHOP_CATEGORIES.find(item => item.slug === activeCategory);
  const title = occasion?.heading || (activeSubject
    ? `${activeSubject} Frames`
    : activeCategoryDetails?.name || 'Shop all');
  const basePath = subject
    ? shopSubjectHref(category, subject)
    : category
      ? shopCategoryHref(category)
      : activeSubject && getShopSubject(activeCategory, activeSubject)
        ? shopSubjectHref(activeCategory, activeSubject)
        : activeCategory
          ? shopCategoryHref(activeCategory)
          : '/shop';
  const link = (options) => {
    const params = new URLSearchParams(Object.entries(searchParams).filter(([key, value]) =>
      ['q', 'sort', 'min', 'max', 'occasion'].includes(key) && value));
    for (const [key, value] of Object.entries(options)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const suffix = params.toString();
    return suffix ? `${basePath}?${suffix}` : basePath;
  };

  return (<div className="wrap shop">
    <JsonLd data={{
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: title,
      description: activeCategoryDetails?.description || `${title} from ${BUSINESS_NAME}.`,
      url: absoluteUrl(basePath),
      isPartOf: { '@type': 'WebSite', name: BUSINESS_NAME, url: absoluteUrl('/') },
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: list.length,
        itemListElement: list.map((product, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: product.name,
          url: absoluteUrl(`/product/${encodeURIComponent(product.slug)}`),
        })),
      },
    }} />
    <nav className="product-breadcrumbs" aria-label="Breadcrumb">
      <Link href="/">Home</Link><span aria-hidden="true">/</span>
      <Link href="/shop">Shop</Link>
      {activeCategoryDetails && <><span aria-hidden="true">/</span>
        <Link href={shopCategoryHref(activeCategory)}>{activeCategoryDetails.name}</Link></>}
      {activeSubject && <><span aria-hidden="true">/</span><span aria-current="page">{activeSubject}</span></>}
    </nav>
    <div className="shop-heading">
      <div><span className="eyebrow">THE GIFTERS HUB CATALOGUE</span><h1>{searchParams.q ? `Results for “${searchParams.q}”` : title}</h1></div>
      <span className="shop-count">{list.length} {list.length === 1 ? 'design' : 'designs'}</span>
    </div>
    {activeCategoryDetails?.description && <p className="shop-category-description">{activeCategoryDetails.description}</p>}
    <form className="shop-search" action={basePath} role="search">
      <label className="sr-only" htmlFor="shop-search">Search products</label>
      <input id="shop-search" type="search" name="q" defaultValue={searchParams.q || ''} placeholder="Search by design or deity" />
      {activeCategory && <input type="hidden" name="category" value={activeCategory} />}
      {activeSubject && <input type="hidden" name="subject" value={activeSubject} />}
      {searchParams.occasion && <input type="hidden" name="occasion" value={searchParams.occasion} />}
      <button type="submit" className="btn">Search</button>
    </form>
    {activeCategory === 'god-frames' && <section className="shop-filters" aria-label="Browse god frames by artwork">
      <div className="filter-group">
        <h2>Browse by deity</h2>
        <div className="filters">{GOD_FRAME_SUBJECTS.map(item => <Link key={item}
          href={shopSubjectHref(activeCategory, item)}
          className={activeSubject === item ? 'on' : ''}
          aria-current={activeSubject === item ? 'page' : undefined}>{item}</Link>)}</div>
      </div>
    </section>}
    {list.some(product => Number.isFinite(product.price)) && <section className="shop-filters" aria-label="Filter products by price">
      <div className="filter-group">
        <h2>Price</h2>
        <div className="filters">{PRICE_RANGES.map(([name, min, max]) => {
          const active = (searchParams.min || '') === (min || '') && (searchParams.max || '') === (max || '');
          return <Link key={name} href={link({ min, max })} className={active ? 'on' : ''} aria-current={active ? 'page' : undefined}>{name}</Link>;
        })}</div>
      </div>
    </section>}
    <div className="toolbar">
      <span>{occasion ? `Curated for ${occasion.title}` : activeSubject ? `Artwork: ${activeSubject}` : 'Browse this collection'}</span>
      {(searchParams.min || searchParams.max || searchParams.q || occasion) && <Link className="clear-filters" href={occasion ? `/shop?occasion=${occasion.slug}` : basePath}>Clear search &amp; filters</Link>}
      {list.some(product => Number.isFinite(product.price)) && (
        <div aria-label="Sort products">{[['Featured', ''], ['Price: low to high', 'low'], ['Price: high to low', 'high']].map(([name, sort]) =>
          <Link key={name} href={link({ sort })} className={(searchParams.sort || '') === sort ? 'on' : ''}>{name}</Link>)}</div>
      )}
    </div>
    {occasion && <p className="gifting-collection-description">{occasion.description} The current retail catalogue is not yet available to order.</p>}
    {list.length ? <>
      {!list.some(product => product.available !== false && Number.isFinite(product.price) && product.price > 0) && (
        <p className="catalogue-notice">Retail prices and ordering are coming soon. Product pages include available dimensions and finish details.</p>
      )}
      <Reveal className="grid">{list.map((product, index) => <ProductCard key={product.slug} p={product} priority={index < 4} />)}</Reveal>
    </> : <div className="shop-empty"><h2>No designs found</h2><p>Try a different deity or search term, or browse another collection.</p><Link className="btn" href="/shop">Browse categories</Link></div>}
    <nav className="shop-other-categories" aria-label="Other collections">
      {SHOP_CATEGORIES.filter(item => item.slug !== activeCategory).map(item =>
        <Link key={item.slug} href={shopCategoryHref(item.slug)}>Explore {item.name} <span aria-hidden="true">→</span></Link>)}
    </nav>
    <RecentlyViewedProducts />
  </div>);
}
