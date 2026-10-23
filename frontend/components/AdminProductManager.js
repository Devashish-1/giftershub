'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

const CATEGORIES = [
  ['god-frames', 'God Frames'],
  ['family-frames', 'Family Frames'],
  ['crystal-bubble', 'Crystal Bubble'],
];
const STATUSES = [
  ['coming-soon', 'Coming soon'],
  ['active', 'Active'],
  ['out-of-stock', 'Out of stock'],
];

function emptyProduct() {
  return {
    slug: '',
    name: '',
    category: 'god-frames',
    subject: '',
    sku: '',
    barcode: '',
    unit: 'piece',
    image: '',
    gallery: '',
    price: '',
    purchasePrice: '',
    mrp: '',
    taxRate: 0,
    lowStockThreshold: '0',
    status: 'coming-soon',
    desc: '',
  };
}

function productForm(product) {
  if (!product) return emptyProduct();
  return {
    slug: product.slug,
    name: product.name || '',
    category: product.category || 'god-frames',
    subject: product.subject || '',
    sku: product.sku || '',
    barcode: product.barcode || '',
    unit: product.unit || 'piece',
    image: product.image || '',
    gallery: (product.gallery || []).join(', '),
    price: product.price ?? '',
    purchasePrice: product.purchasePrice ?? '',
    mrp: product.mrp ?? '',
    taxRate: product.taxRate ?? 0,
    lowStockThreshold: product.lowStockThreshold ?? 0,
    status: product.status || (product.available ? 'active' : 'coming-soon'),
    desc: product.desc || '',
  };
}

function money(value) {
  return value == null ? '—' : `₹${Number(value).toLocaleString('en-IN')}`;
}

function PageControls({ page, total, pageSize, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="admin-pagination">
      <span>Page {page} of {pages}</span>
      <div>
        <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1}>Previous</button>
        <button type="button" onClick={() => onChange(page + 1)} disabled={page >= pages}>Next</button>
      </div>
    </div>
  );
}

function ProductEditor({ product, categories, units, saving, onClose, onSave }) {
  const [form, setForm] = useState(() => productForm(product));
  const update = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  const submit = event => {
    event.preventDefault();
    onSave({
      ...form,
      slug: form.slug.trim().toLowerCase(),
      sku: form.sku.trim(),
      barcode: form.barcode.trim(),
      gallery: form.gallery.split(',').map(image => image.trim()).filter(Boolean),
      price: form.price === '' ? null : Number(form.price),
      purchasePrice: form.purchasePrice === '' ? null : Number(form.purchasePrice),
      mrp: form.mrp === '' ? null : Number(form.mrp),
      taxRate: Number(form.taxRate),
      lowStockThreshold: Number(form.lowStockThreshold || 0),
    });
  };

  return (
    <div className="admin-editor-backdrop" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="admin-product-editor" role="dialog" aria-modal="true" aria-labelledby="admin-editor-title">
        <div className="admin-panel-heading">
          <div><span>Product catalogue</span><h2 id="admin-editor-title">{product ? 'Edit product' : 'Add a product'}</h2></div>
          <button className="admin-icon-button" type="button" onClick={onClose} aria-label="Close editor">×</button>
        </div>
        <form className="admin-product-form" onSubmit={submit}>
          {!product && <label>Product URL slug<input name="slug" value={form.slug} onChange={update} placeholder="e.g. radha-ka-mohan" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></label>}
          <label>Product name<input name="name" value={form.name} onChange={update} minLength={2} maxLength={120} required /></label>
          <div className="admin-form-row">
            <label>Category<select name="category" value={form.category} onChange={update}>{categories.map(category => <option key={category.slug} value={category.slug}>{category.name}</option>)}</select></label>
            <label>Deity / artwork<input name="subject" value={form.subject} onChange={update} maxLength={80} placeholder="e.g. Radha Krishna" /></label>
          </div>
          <div className="admin-form-row">
            <label>SKU / item code<input name="sku" value={form.sku} onChange={update} maxLength={80} /></label>
            <label>Barcode<input name="barcode" value={form.barcode} onChange={update} maxLength={80} /></label>
          </div>
          <div className="admin-form-row">
            <label>Unit<select name="unit" value={form.unit} onChange={update}>{units.map(unit => <option key={unit} value={unit}>{unit}</option>)}</select></label>
            <label>Low-stock threshold<input name="lowStockThreshold" type="number" min="0" step="1" value={form.lowStockThreshold} onChange={update} /></label>
          </div>
          <label>Main image path<input name="image" value={form.image} onChange={update} placeholder="/products/image-name.webp" pattern="/products/[A-Za-z0-9][A-Za-z0-9._-]*\.(webp|png|jpe?g)" required /></label>
          <label>Gallery image paths<small>Comma-separated paths from /products</small><input name="gallery" value={form.gallery} onChange={update} placeholder="/products/image-1.webp, /products/image-2.webp" /></label>
          <div className="admin-form-row">
            <label>Selling price (₹)<input name="price" type="number" min="0" step="0.01" value={form.price} onChange={update} /></label>
            <label>MRP (₹)<input name="mrp" type="number" min="0" step="0.01" value={form.mrp} onChange={update} /></label>
          </div>
          <label>Purchase price (₹)<input name="purchasePrice" type="number" min="0" step="0.01" value={form.purchasePrice} onChange={update} /></label>
          <label>Tax rate (added to selling price)<select name="taxRate" value={form.taxRate} onChange={update}>{[0, 5, 12, 18, 28].map(rate => <option key={rate} value={rate}>{rate}%</option>)}</select></label>
          <label>Status<select name="status" value={form.status} onChange={update}>{STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Description<textarea name="desc" value={form.desc} onChange={update} maxLength={3000} rows={4} /></label>
          <div className="admin-editor-actions">
            <button type="button" className="admin-secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="admin-primary-button" disabled={saving}>{saving ? 'Saving…' : product ? 'Save changes' : 'Add product'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function AdminProductManager() {
  const [collection, setCollection] = useState({ items: [], page: 1, pageSize: 20, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(undefined);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [categories, setCategories] = useState(CATEGORIES.map(([slug, name]) => ({ slug, name })));
  const [units, setUnits] = useState(['piece', 'pcs', 'unit', 'set', 'pair', 'box']);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({
        page: String(page),
        q: search,
        status: statusFilter,
        lowStock: String(lowStockOnly),
      });
      const response = await fetch(`/api/admin/products?${query}`, { credentials: 'same-origin' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load the product catalogue.');
      setCollection(result);
    } catch (requestError) {
      setError(requestError.message || 'Could not load the product catalogue.');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, lowStockOnly]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(['/api/admin/categories', '/api/admin/units'].map(async url => {
      const response = await fetch(url, { credentials: 'same-origin' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load item settings.');
      return result.items;
    })).then(([categoryRecords, unitRecords]) => {
      if (cancelled) return;
      setCategories(categoryRecords);
      setUnits(unitRecords.map(unit => unit.name));
    }).catch(requestError => {
      if (!cancelled) setError(requestError.message || 'Could not load item categories and units.');
    });
    return () => { cancelled = true; };
  }, []);

  const saveProduct = async product => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const isEditing = !!editing;
      const response = await fetch(isEditing
        ? `/api/admin/products/${encodeURIComponent(editing.slug)}`
        : '/api/admin/products', {
        method: isEditing ? 'PUT' : 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save this product.');
      setEditing(undefined);
      setNotice(isEditing ? 'Product changes saved.' : 'Product added to the catalogue.');
      await loadProducts();
    } catch (requestError) {
      setError(requestError.message || 'Could not save this product.');
    } finally {
      setSaving(false);
    }
  };

  const archiveProduct = async product => {
    if (!window.confirm(`Hide “${product.name}” from the public catalogue?`)) return;
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/admin/products/${encodeURIComponent(product.slug)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not hide this product.');
      setNotice('Product hidden from the public catalogue. You can restore it by editing it.');
      await loadProducts();
    } catch (requestError) {
      setError(requestError.message || 'Could not hide this product.');
    }
  };

  const restoreProduct = async product => {
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/admin/products/${encodeURIComponent(product.slug)}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...product,
          status: product.status || (product.available ? 'active' : 'coming-soon'),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not restore this product.');
      setNotice('Product restored to the public catalogue.');
      await loadProducts();
    } catch (requestError) {
      setError(requestError.message || 'Could not restore this product.');
    }
  };

  return (
    <section className="admin-panel admin-catalogue-panel" aria-labelledby="admin-products-title">
      <div className="admin-panel-heading">
        <div><span>Catalogue control</span><h2 id="admin-products-title">Products</h2><span>{collection.total} products</span></div>
        <div className="admin-product-tools">
          <Link className="admin-secondary-button" href="/admin/vyapaar/import">Import CSV</Link>
          <button className="admin-secondary-button" type="button" onClick={() => window.location.assign('/api/admin/products/export')}>Export CSV</button>
          <button className="admin-primary-button" type="button" onClick={() => setEditing(null)}>+ Add product</button>
        </div>
      </div>
      <div className="admin-catalogue-filters">
        <label className="admin-search">Search products<input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Name, slug, SKU, barcode, or deity" /></label>
        <label className="admin-catalogue-status">Catalogue status<select value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(1); }}>
          <option value="">All items</option><option value="active">Active</option><option value="coming-soon">Coming soon</option><option value="out-of-stock">Out of stock</option><option value="archived">Hidden</option>
        </select></label>
        <label className="admin-low-stock-filter"><input type="checkbox" checked={lowStockOnly} onChange={event => { setLowStockOnly(event.target.checked); setPage(1); }} /> Low-stock only</label>
      </div>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {notice && <p className="admin-notice" role="status">{notice}</p>}
      {loading
        ? <p className="admin-loading">Loading products…</p>
        : collection.items.length
          ? <div className="admin-product-list">{collection.items.map(product => (
            <article className={`admin-product-row${product.archived ? ' archived' : ''}`} key={product.slug}>
              <img src={product.image} alt="" />
              <div className="admin-product-identity">
                <b>{product.name}</b><span>{product.subject || product.category} · {product.slug}</span>
                {(product.sku || product.barcode) && <span>{product.sku ? `SKU ${product.sku}` : ''}{product.sku && product.barcode ? ' · ' : ''}{product.barcode ? `Barcode ${product.barcode}` : ''}</span>}
              </div>
              <div className="admin-product-meta">
                <b>{money(product.price)}</b>
                <span>{product.archived ? 'Hidden' : product.status || 'Coming soon'} · Stock {product.stock ?? 0} · Tax {product.taxRate ?? 0}%</span>
              </div>
              <div className="admin-product-actions">
                <button className="admin-secondary-button" type="button" onClick={() => setEditing(product)}>Edit</button>
                {product.archived
                  ? <button className="admin-secondary-button" type="button" onClick={() => restoreProduct(product)}>Restore</button>
                  : <button className="admin-danger-button" type="button" onClick={() => archiveProduct(product)}>Hide</button>}
              </div>
            </article>
          ))}</div>
          : <p className="admin-empty">{search ? 'No products match your search.' : 'No products found.'}</p>}
      {!loading && collection.total > collection.pageSize && <PageControls
        page={collection.page}
        total={collection.total}
        pageSize={collection.pageSize}
        onChange={setPage}
      />}
      {editing !== undefined && <ProductEditor
        product={editing || null}
        categories={categories}
        units={units}
        saving={saving}
        onClose={() => setEditing(undefined)}
        onSave={saveProduct}
      />}
    </section>
  );
}
