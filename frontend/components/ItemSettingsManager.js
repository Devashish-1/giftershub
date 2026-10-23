'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

export default function ItemSettingsManager() {
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [categoryName, setCategoryName] = useState('');
  const [unitName, setUnitName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [categoryResponse, unitResponse] = await Promise.all([
        fetch('/api/admin/categories', { credentials: 'same-origin' }),
        fetch('/api/admin/units', { credentials: 'same-origin' }),
      ]);
      const [categoryResult, unitResult] = await Promise.all([categoryResponse.json(), unitResponse.json()]);
      if (!categoryResponse.ok) throw new Error(categoryResult.error || 'Could not load item categories.');
      if (!unitResponse.ok) throw new Error(unitResult.error || 'Could not load units.');
      setCategories(categoryResult.items);
      setUnits(unitResult.items);
    } catch (requestError) {
      setError(requestError.message || 'Could not load item settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const save = async (url, method, body, successMessage) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save item settings.');
      setNotice(successMessage);
      await loadSettings();
    } catch (requestError) {
      setError(requestError.message || 'Could not save item settings.');
    } finally {
      setSaving(false);
    }
  };

  const createCategory = event => {
    event.preventDefault();
    save('/api/admin/categories', 'POST', { name: categoryName }, 'Category added.');
    setCategoryName('');
  };

  const createUnit = event => {
    event.preventDefault();
    save('/api/admin/units', 'POST', { name: unitName }, 'Unit added.');
    setUnitName('');
  };

  return (
    <div className="vyapaar-content">
      <section className="vyapaar-page-heading">
        <span className="vyapaar-eyebrow">INVENTORY · ITEM SETTINGS</span>
        <h1>Categories &amp; units</h1>
        <p>Organize the shared product catalogue. Categories and units already used by active items cannot be archived.</p>
      </section>
      <div className="admin-editor-actions vyapaar-settings-actions">
        <Link href="/admin/vyapaar/items" className="admin-secondary-button">Items</Link>
        <Link href="/admin/vyapaar/stock" className="admin-secondary-button">Stock adjustments</Link>
      </div>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {notice && <p className="admin-notice" role="status">{notice}</p>}
      {loading ? <p className="admin-loading">Loading categories and units…</p> : <div className="vyapaar-item-settings-grid">
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><span>PRODUCT CLASSIFICATION</span><h2>Categories</h2></div></div>
          <form className="vyapaar-inline-create" onSubmit={createCategory}>
            <label>Category name<input value={categoryName} onChange={event => setCategoryName(event.target.value)} minLength={2} maxLength={80} required /></label>
            <button className="admin-primary-button" type="submit" disabled={saving}>Add category</button>
          </form>
          <div className="vyapaar-settings-list">{categories.map(category => (
            <article key={category.slug}>
              <div><b>{category.name}</b><span>{category.itemCount} active items · {category.slug}</span></div>
              {!category.itemCount && <button className="admin-danger-button" type="button" onClick={() => save(`/api/admin/categories/${encodeURIComponent(category.slug)}`, 'PATCH', { archived: true }, 'Category archived.')}>Archive</button>}
            </article>
          ))}</div>
        </section>
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><span>QUANTITY MEASUREMENT</span><h2>Units</h2></div></div>
          <form className="vyapaar-inline-create" onSubmit={createUnit}>
            <label>Unit name<input value={unitName} onChange={event => setUnitName(event.target.value)} minLength={1} maxLength={24} pattern="[A-Za-z0-9][A-Za-z0-9 -]*" required /></label>
            <button className="admin-primary-button" type="submit" disabled={saving}>Add unit</button>
          </form>
          <div className="vyapaar-settings-list">{units.map(unit => (
            <article key={unit.name}>
              <div><b>{unit.name}</b><span>{unit.itemCount} active items</span></div>
              {!unit.itemCount && <button className="admin-danger-button" type="button" onClick={() => save(`/api/admin/units/${encodeURIComponent(unit.name)}`, 'DELETE', null, 'Unit archived.')}>Archive</button>}
            </article>
          ))}</div>
        </section>
      </div>}
    </div>
  );
}
