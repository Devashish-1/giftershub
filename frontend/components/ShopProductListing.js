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
  const facetSubject = subject || occasion?.subject || '';
  const showSubjectFilter = !subject && !occasion?.subject;
  const query = {
    ...Object.fromEntries(Object.entries(searchParams).filter(([key, value]) =>
      ['q', 'sort', 'min', 'max', 'design', 'finish', 'size', 'lights'].includes(key) && value)),
    ...(activeCategory ? { category: activeCategory } : {}),
    ...(activeSubject ? { subject: activeSubject } : {}),
  };
  const facetQuery = new URLSearchParams({
    ...(activeCategory ? { category: activeCategory } : {}),
    ...(facetSubject ? { subject: facetSubject } : {}),
  });
  const facetProducts = (await get('/api/products?' + facetQuery.toString())) || [];
  const list = (await get('/api/products?' + new URLSearchParams(query).toString())) || [];
  const subjects = [...new Set(facetProducts.map(product => product.subject).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const designs = [...new Set(facetProducts.map(product => product.details?.Model).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const finishes = [...new Set(facetProducts.flatMap(product => product.options?.Colour || product.options?.Color || []))].sort((a, b) => a.localeCompare(b));
  const sizes = [...new Set(facetProducts.map(product => product.details?.Size).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const displaySubjectFilter = showSubjectFilter && subjects.length > 1;
  const hasPrices = facetProducts.some(product => Number.isFinite(product.price));
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
      {activeSubject && !displaySubjectFilter && <input type="hidden" name="subject" value={activeSubject} />}
      {searchParams.occasion && <input type="hidden" name="occasion" value={searchParams.occasion} />}
      {['design', 'finish', 'size', 'lights', 'sort', 'min', 'max'].map(key =>
        searchParams[key] ? <input key={key} type="hidden" name={key} value={searchParams[key]} /> : null)}
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
    <form className="shop-filters catalogue-filter-panel" action={basePath} aria-label="Filter and sort products">
      {activeCategory && <input type="hidden" name="category" value={activeCategory} />}
      {activeSubject && <input type="hidden" name="subject" value={activeSubject} />}
      {searchParams.q && <input type="hidden" name="q" value={searchParams.q} />}
      {searchParams.occasion && <input type="hidden" name="occasion" value={searchParams.occasion} />}
      <div className="catalogue-filter-grid">
        {displaySubjectFilter && <label>
          <span>Deity</span>
          <select name="subject" defaultValue={searchParams.subject || ''}><option value="">All deities</option>{subjects.map(item => <option key={item} value={item}>{item}</option>)}</select>
        </label>}
        <label>
          <span>Design</span>
          <select name="design" defaultValue={searchParams.design || ''}><option value="">All designs</option>{designs.map(item => <option key={item} value={item}>{item}</option>)}</select>
        </label>
        {finishes.length > 0 && <label>
          <span>Finish</span>
          <select name="finish" defaultValue={searchParams.finish || ''}><option value="">All finishes</option>{finishes.map(item => <option key={item} value={item}>{item}</option>)}</select>
        </label>}
        {sizes.length > 0 && <label>
          <span>Size</span>
          <select name="size" defaultValue={searchParams.size || ''}><option value="">All sizes</option>{sizes.map(item => <option key={item} value={item}>{item}</option>)}</select>
        </label>}
        <label>
          <span>Lighting</span>
          <select name="lights" defaultValue={searchParams.lights || ''}><option value="">Any lighting</option><option value="with">With lights</option><option value="without">Without lights</option></select>
        </label>
        <label>
          <span>Sort by</span>
          <select name="sort" defaultValue={searchParams.sort || ''}>
            <option value="">Featured</option><option value="name">Name: A to Z</option><option value="name_desc">Name: Z to A</option>
            {hasPrices && <><option value="low">Price: low to high</option><option value="high">Price: high to low</option></>}
          </select>
        </label>
        {hasPrices && <>
          <label>
            <span>Minimum price</span>
            <select name="min" defaultValue={searchParams.min || ''}><option value="">No minimum</option>{PRICE_RANGES.filter(([, min]) => min).map(([name, min]) => <option key={min} value={min}>{name}</option>)}</select>
          </label>
          <label>
            <span>Maximum price</span>
            <select name="max" defaultValue={searchParams.max || ''}><option value="">No maximum</option>{PRICE_RANGES.filter(([, , max]) => max).map(([name, , max]) => <option key={max} value={max}>{name}</option>)}</select>
          </label>
        </>}
        <button className="btn catalogue-filter-submit" type="submit">Apply filters</button>
      </div>
    </form>
    <div className="toolbar">
      <span>{occasion ? `Curated for ${occasion.title}` : activeSubject ? `Artwork: ${activeSubject}` : 'Browse this collection'}</span>
      <span className="catalogue-result-count">Showing {list.length} {list.length === 1 ? 'design' : 'designs'}</span>
      {(searchParams.min || searchParams.max || searchParams.q || searchParams.design || searchParams.finish || searchParams.size || searchParams.lights || searchParams.sort || (searchParams.subject && !subject) || occasion) &&
        <Link className="clear-filters" href={occasion ? `/shop?occasion=${occasion.slug}` : basePath}>Clear search &amp; filters</Link>}
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
