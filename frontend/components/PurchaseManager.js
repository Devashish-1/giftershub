'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

const formatMoney = amount => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);
const lineTotal = line => {
  const basePaise = Math.round(Number(line.unitCost || 0) * Number(line.quantity || 0) * 100);
  return (basePaise + Math.round(basePaise * Number(line.taxRate || 0) / 100)) / 100;
};

export default function PurchaseManager() {
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierQuery, setSupplierQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [initialPayment, setInitialPayment] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState([]);
  const [productQuery, setProductQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadPurchases = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const purchaseResponse = await fetch('/api/admin/purchases?page=1', { credentials: 'same-origin' });
      const purchaseResult = await purchaseResponse.json();
      if (!purchaseResponse.ok) throw new Error(purchaseResult.error || 'Could not load purchases.');
      setPurchases(purchaseResult.items);
    } catch (requestError) {
      setError(requestError.message || 'Could not load purchase records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPurchases(); }, [loadPurchases]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ page: '1', type: 'supplier', q: supplierQuery.trim() });
        const response = await fetch(`/api/admin/parties?${params}`, { credentials: 'same-origin' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not load suppliers.');
        if (!cancelled) setSuppliers(current => {
          const selected = current.find(item => item.id === supplierId);
          return selected && !result.items.some(item => item.id === selected.id) ? [selected, ...result.items] : result.items;
        });
      } catch (requestError) {
        if (!cancelled) setError(requestError.message || 'Could not load suppliers.');
      }
    }, 150);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [supplierQuery, supplierId]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ page: '1', q: productQuery.trim() });
        const response = await fetch(`/api/admin/products?${params}`, { credentials: 'same-origin' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not search items.');
        if (!cancelled) setProducts(result.items.filter(item => !item.archived));
      } catch (requestError) {
        if (!cancelled) setError(requestError.message || 'Could not search items.');
      }
    }, 200);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [productQuery]);

  const addProduct = product => {
    setLines(current => current.some(line => line.slug === product.slug)
      ? current.map(line => line.slug === product.slug ? { ...line, quantity: line.quantity + 1 } : line)
      : [...current, { slug: product.slug, name: product.name, quantity: 1, unitCost: product.purchasePrice ?? 0, taxRate: product.taxRate ?? 0 }]);
  };

  const updateLine = (slug, field, value) => setLines(current => current.map(line => line.slug === slug
    ? { ...line, [field]: field === 'quantity' ? (value === '' ? '' : Number(value)) : value }
    : line));

  const savePurchase = async event => {
    event.preventDefault();
    if (!supplierId || !billNumber.trim() || !lines.length) {
      setError('Select a supplier, enter the supplier bill number, and add at least one item.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/purchases', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: window.crypto.randomUUID(),
          supplierId,
          billNumber,
          initialPayment: Number(initialPayment || 0),
          note,
          lines: lines.map(line => ({ slug: line.slug, quantity: Number(line.quantity), unitCost: Number(line.unitCost) })),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not record purchase.');
      setNotice(`Purchase ${result.purchaseNumber} saved. Inventory stock has been updated.`);
      setBillNumber('');
      setInitialPayment('');
      setNote('');
      setLines([]);
      await loadPurchases();
    } catch (requestError) {
      setError(requestError.message || 'Could not record purchase.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="vyapaar-content">
      <section className="vyapaar-page-heading">
        <span className="vyapaar-eyebrow">INVENTORY · PROCUREMENT</span>
        <h1>Purchases</h1>
        <p>Record supplier bills to increase stock and capture purchase cost. The supplier bill number must be unique per supplier.</p>
      </section>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {notice && <p className="admin-notice" role="status">{notice}</p>}
      <form className="admin-panel vyapaar-purchase-form" onSubmit={savePurchase}>
        <div className="admin-panel-heading"><div><span>RECEIVE INVENTORY</span><h2>New purchase</h2></div><Link href="/admin/vyapaar/parties" className="admin-secondary-button">Manage suppliers</Link></div>
        <div className="admin-product-form">
          <div className="admin-form-row">
            <label>Find supplier<input value={supplierQuery} onChange={event => setSupplierQuery(event.target.value)} placeholder="Search suppliers" /></label>
            <label>Supplier<select value={supplierId} onChange={event => setSupplierId(event.target.value)} required>
              <option value="">Choose supplier</option>{suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select></label>
          </div>
          <div className="admin-form-row">
            <label>Supplier bill number<input value={billNumber} onChange={event => setBillNumber(event.target.value)} maxLength={100} required /></label>
          </div>
          <label>Find catalogue item<input value={productQuery} onChange={event => setProductQuery(event.target.value)} placeholder="Search by item name, SKU or barcode" /></label>
          <div className="vyapaar-purchase-products">{products.slice(0, 8).map(product => <button type="button" key={product.slug} onClick={() => addProduct(product)}>
            <span><b>{product.name}</b><small>Stock {product.stock ?? 0} · Cost {formatMoney(product.purchasePrice ?? 0)}</small></span><strong>+ Add</strong>
          </button>)}</div>
          {lines.length > 0 && <div className="vyapaar-sales-table-wrap"><table className="vyapaar-sales-table">
            <thead><tr><th>Item</th><th>Quantity</th><th>Unit cost (₹)</th><th>Line total (incl. tax)</th><th></th></tr></thead>
            <tbody>{lines.map(line => <tr key={line.slug}>
              <td>{line.name}</td>
              <td><input aria-label={`${line.name} quantity`} type="number" min="1" max="10000" step="1" value={line.quantity} onChange={event => updateLine(line.slug, 'quantity', event.target.value)} /></td>
              <td><input aria-label={`${line.name} unit cost`} type="number" min="0" step="0.01" value={line.unitCost} onChange={event => updateLine(line.slug, 'unitCost', event.target.value)} /></td>
              <td>{formatMoney(lineTotal(line))}</td>
              <td><button type="button" className="admin-danger-button" onClick={() => setLines(current => current.filter(item => item.slug !== line.slug))}>Remove</button></td>
            </tr>)}</tbody>
          </table></div>}
          {lines.length > 0 && <p className="vyapaar-settings-note"><b>Estimated purchase total: {formatMoney(lines.reduce((sum, line) => sum + lineTotal(line), 0))}</b><span>Final total is calculated and validated on the server.</span></p>}
          <div className="admin-form-row">
            <label>Amount paid now (₹)<input type="number" min="0" step="0.01" value={initialPayment} onChange={event => setInitialPayment(event.target.value)} /></label>
            <label>Internal note (optional)<input value={note} onChange={event => setNote(event.target.value)} maxLength={500} /></label>
          </div>
          <p className="vyapaar-settings-note"><b>Purchase cost, payments and tax</b><span>Purchase cost updates to the entered last cost. The purchase records the amount paid and balance due, but not payment methods or a cash/bank ledger. Item tax is operational only and is not statutory GST treatment.</span></p>
          <div className="admin-editor-actions"><button className="admin-primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Record purchase & receive stock'}</button></div>
        </div>
      </form>
      <section className="admin-panel vyapaar-sales-panel">
        <div className="admin-panel-heading"><div><span>Supplier bills</span><h2>Purchase history</h2></div></div>
        {loading ? <p className="admin-loading">Loading purchases…</p> : purchases.length ? <div className="vyapaar-sales-table-wrap"><table className="vyapaar-sales-table">
          <thead><tr><th>Purchase</th><th>Supplier</th><th>Supplier bill</th><th>Items</th><th>Total</th><th>Paid</th><th>Due</th></tr></thead>
          <tbody>{purchases.map(purchase => <tr key={purchase.purchaseNumber}>
            <td>{purchase.purchaseNumber}<small>{new Date(purchase.createdAt).toLocaleDateString()}</small></td><td>{purchase.supplierName}</td>
            <td>{purchase.billNumber}</td><td>{purchase.lines.reduce((sum, line) => sum + line.quantity, 0)}</td>
            <td>{formatMoney(purchase.total)}</td><td>{formatMoney(purchase.amountPaid)}</td><td>{formatMoney(purchase.balanceDue)}</td>
          </tr>)}</tbody>
        </table></div> : <p className="admin-empty">No purchases recorded yet.</p>}
      </section>
    </div>
  );
}
