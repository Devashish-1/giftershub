'use client';

import { useCallback, useEffect, useState } from 'react';

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
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

export default function StockManager() {
  const [collection, setCollection] = useState({ items: [], movements: [], page: 1, pageSize: 30, total: 0 });
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [selectedSlug, setSelectedSlug] = useState('');
  const [mode, setMode] = useState('add');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadStock = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), q: search });
      const response = await fetch(`/api/admin/stock?${params}`, { credentials: 'same-origin' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load inventory records.');
      setCollection(result);
      setSelectedSlug(current => result.items.some(item => item.slug === current) ? current : '');
    } catch (requestError) {
      setError(requestError.message || 'Could not load inventory records.');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { loadStock(); }, [loadStock]);

  const selectedItem = collection.items.find(item => item.slug === selectedSlug);

  const submitAdjustment = async event => {
    event.preventDefault();
    if (!selectedItem) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/stock/adjustments', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: selectedItem.slug,
          mode,
          quantity: Number(quantity),
          reason,
          requestId: window.crypto.randomUUID(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not record this stock adjustment.');
      setQuantity('');
      setReason('');
      setNotice(`${result.itemName}: stock updated from ${result.previousStock} to ${result.newStock}.`);
      await loadStock();
    } catch (requestError) {
      setError(requestError.message || 'Could not record this stock adjustment.');
    } finally {
      setSaving(false);
    }
  };

  const searchItems = event => {
    event.preventDefault();
    setPage(1);
    setSearch(query.trim());
  };

  return (
    <div className="admin-stock-workspace">
      <section className="admin-panel" aria-labelledby="vyapaar-stock-list-title">
        <div className="admin-panel-heading">
          <div><span>On-hand quantities</span><h2 id="vyapaar-stock-list-title">Inventory</h2><span>{collection.total} items tracked</span></div>
          {!loading && collection.total > collection.pageSize && <PageControls page={collection.page} total={collection.total} pageSize={collection.pageSize} onChange={setPage} />}
        </div>
        <form className="admin-stock-search" onSubmit={searchItems}>
          <label>Find an item<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Name, SKU, or barcode" /></label>
          <button type="submit" className="admin-secondary-button">Search</button>
        </form>
        {error && <p className="admin-error" role="alert">{error}</p>}
        {notice && <p className="admin-notice" role="status">{notice}</p>}
        {loading
          ? <p className="admin-loading">Loading inventory…</p>
          : collection.items.length
            ? <div className="admin-stock-table-wrap"><table className="admin-stock-table">
              <thead><tr><th>Item</th><th>SKU / barcode</th><th>On hand</th><th>Stock level</th><th aria-label="Actions" /></tr></thead>
              <tbody>{collection.items.map(item => {
                const low = item.lowStockThreshold > 0 && item.stock <= item.lowStockThreshold;
                return (
                  <tr key={item.slug} className={selectedSlug === item.slug ? 'selected' : ''}>
                    <td><b>{item.name}</b><small>{item.category}</small></td>
                    <td>{item.sku || item.barcode || '—'}</td>
                    <td><b>{item.stock}</b> <span>{item.unit || 'piece'}</span></td>
                    <td><span className={`admin-stock-badge${low ? ' low' : ''}`}>{low ? 'Low stock' : 'In stock'}</span></td>
                    <td><button type="button" className="admin-secondary-button" onClick={() => setSelectedSlug(item.slug)}>Adjust</button></td>
                  </tr>
                );
              })}</tbody>
            </table></div>
            : <p className="admin-empty">{search ? 'No items match your search.' : 'No inventory items yet. Add products from Items & Inventory first.'}</p>}
        {!loading && collection.total > collection.pageSize && <PageControls page={collection.page} total={collection.total} pageSize={collection.pageSize} onChange={setPage} />}
      </section>

      {selectedItem && <section className="admin-panel admin-stock-adjust-panel" aria-labelledby="stock-adjust-heading">
        <div className="admin-panel-heading"><div><span>Audited stock movement</span><h2 id="stock-adjust-heading">Adjust {selectedItem.name}</h2><span>Current stock: {selectedItem.stock} {selectedItem.unit || 'piece'}</span></div></div>
        <form className="admin-stock-form" onSubmit={submitAdjustment}>
          <label>Adjustment type<select value={mode} onChange={event => setMode(event.target.value)}>
            <option value="opening">Opening stock (first entry)</option>
            <option value="add">Add stock</option>
            <option value="remove">Remove stock</option>
            <option value="set">Set exact quantity</option>
          </select></label>
          <label>{mode === 'set' ? 'New stock quantity' : 'Quantity'}<input type="number" min={mode === 'set' ? '0' : '1'} step="1" value={quantity} onChange={event => setQuantity(event.target.value)} required /></label>
          <label className="admin-stock-reason">Reason<textarea value={reason} onChange={event => setReason(event.target.value)} minLength={3} maxLength={500} rows={2} placeholder="e.g. Physical stock count correction" required /></label>
          <button className="admin-primary-button" type="submit" disabled={saving}>{saving ? 'Saving adjustment…' : 'Save stock adjustment'}</button>
        </form>
      </section>}

      <section className="admin-panel" aria-labelledby="stock-history-heading">
        <div className="admin-panel-heading"><div><span>Latest recorded movements</span><h2 id="stock-history-heading">Stock history</h2></div></div>
        {collection.movements.length
          ? <div className="admin-stock-history">{collection.movements.map(movement => (
            <article key={movement.requestId}>
              <div><b>{movement.itemName}</b><span>{movement.reason}</span><small>{formatDate(movement.createdAt)} · {movement.createdByEmail}</small></div>
              <span className={movement.quantity > 0 ? 'positive' : 'negative'}>{movement.quantity > 0 ? '+' : ''}{movement.quantity}</span>
              <span>{movement.previousStock} → {movement.newStock}</span>
            </article>
          ))
          : <p className="admin-empty">No stock movements have been recorded yet.</p>}
      </section>
    </div>
  );
}
