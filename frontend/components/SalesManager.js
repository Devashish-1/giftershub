'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

function money(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(date);
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

export function SalesManager() {
  const [collection, setCollection] = useState({ items: [], page: 1, pageSize: 25, total: 0 });
  const [page, setPage] = useState(1);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSales = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), q: query, status, from: dateFrom, to: dateTo });
      const response = await fetch(`/api/admin/sales?${params}`, { credentials: 'same-origin' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load invoices.');
      setCollection(result);
    } catch (requestError) {
      setError(requestError.message || 'Could not load invoices.');
    } finally {
      setLoading(false);
    }
  }, [page, query, status, dateFrom, dateTo]);

  useEffect(() => { loadSales(); }, [loadSales]);

  const search = event => {
    event.preventDefault();
    setPage(1);
    setQuery(queryInput.trim());
  };

  return (
    <section className="admin-panel vyapaar-sales-panel" aria-labelledby="vyapaar-sales-title">
      <div className="admin-panel-heading">
        <div><span>Invoices and collections</span><h2 id="vyapaar-sales-title">Sales &amp; invoices</h2><span>{collection.total} invoices</span></div>
        <Link className="admin-primary-button" href="/admin/vyapaar/sales/new">+ Create sale</Link>
      </div>
      <form className="admin-order-filters" onSubmit={search}>
        <label>Search invoices<input value={queryInput} onChange={event => setQueryInput(event.target.value)} placeholder="Invoice, customer, phone or email" /></label>
        <label>Payment status<select value={status} onChange={event => { setPage(1); setStatus(event.target.value); }}>
          <option value="">All statuses</option>
          <option value="issued">Unpaid</option>
          <option value="partially-paid">Partially paid</option>
          <option value="paid">Paid</option>
        </select></label>
        <label>From<input type="date" value={dateFrom} onChange={event => { setPage(1); setDateFrom(event.target.value); }} /></label>
        <label>To<input type="date" value={dateTo} onChange={event => { setPage(1); setDateTo(event.target.value); }} /></label>
        <button type="submit" className="admin-secondary-button">Search</button>
      </form>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {loading
        ? <p className="admin-loading">Loading sales…</p>
        : collection.items.length
          ? <>
            <div className="vyapaar-sales-table-wrap"><table className="vyapaar-sales-table">
              <thead><tr><th>Invoice</th><th>Customer</th><th>Date</th><th>Items</th><th>Total</th><th>Paid</th><th>Due</th><th>Status</th></tr></thead>
              <tbody>{collection.items.map(sale => (
                <tr key={sale.invoiceNumber}>
                  <td><Link href={`/admin/vyapaar/sales/${encodeURIComponent(sale.invoiceNumber)}`}>{sale.invoiceNumber}</Link></td>
                  <td>{sale.customer.name}</td><td>{formatDate(sale.createdAt)}</td><td>{sale.lineCount}</td>
                  <td>{money(sale.total)}</td><td>{money(sale.amountPaid)}</td><td>{money(sale.balanceDue)}</td>
                  <td><span className={`vyapaar-invoice-status ${sale.status}`}>{sale.status === 'issued' ? 'Unpaid' : sale.status === 'partially-paid' ? 'Part paid' : 'Paid'}</span></td>
                </tr>
              ))}</tbody>
            </table></div>
            {collection.total > collection.pageSize && <PageControls page={collection.page} total={collection.total} pageSize={collection.pageSize} onChange={setPage} />}
          </>
          : <p className="admin-empty">{query || status ? 'No invoices match these filters.' : 'No sales invoices yet. Create a sale to begin recording invoices and stock deductions.'}</p>}
    </section>
  );
}

export function SaleComposer() {
  const [products, setProducts] = useState([]);
  const [productQuery, setProductQuery] = useState('');
  const [customer, setCustomer] = useState({ partyId: '', name: '', phone: '', email: '', address: '' });
  const [customers, setCustomers] = useState([]);
  const [lines, setLines] = useState([]);
  const [invoiceDiscount, setInvoiceDiscount] = useState('0');
  const [initialPayment, setInitialPayment] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [catalogError, setCatalogError] = useState('');
  const [customerError, setCustomerError] = useState('');
  const [requestId, setRequestId] = useState('');

  const loadProducts = useCallback(async query => {
    setLoadingProducts(true);
    setCatalogError('');
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      const response = await fetch(`/api/admin/sales/catalog?${params}`, { credentials: 'same-origin' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load products.');
      setProducts(result.items);
    } catch (requestError) {
      setCatalogError(requestError.message || 'Could not load products.');
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => { loadProducts(''); }, [loadProducts]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/parties?page=1&type=customer', { credentials: 'same-origin' })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Could not load saved customers.');
        if (!cancelled) setCustomers(payload.items);
      })
      .catch(requestError => {
        if (!cancelled) setCustomerError(requestError.message || 'Could not load saved customers.');
      });
    return () => { cancelled = true; };
  }, []);

  const updateCustomer = event => {
    if (event.target.name === 'partyId') {
      const party = customers.find(item => item.id === event.target.value);
      setCustomer(party
        ? { partyId: party.id, name: party.name, phone: party.phone || '', email: party.email || '', address: party.address || '' }
        : { partyId: '', name: '', phone: '', email: '', address: '' });
      return;
    }
    setCustomer(current => ({ ...current, [event.target.name]: event.target.value }));
  };
  const addProduct = product => {
    setLines(current => current.some(line => line.slug === product.slug)
      ? current.map(line => line.slug === product.slug && line.quantity < product.stock
        ? { ...line, quantity: line.quantity + 1 }
        : line)
      : [...current, { ...product, quantity: 1, discount: '0' }]);
  };
  const updateLine = (slug, field, value) => setLines(current => current.map(line =>
    line.slug === slug ? { ...line, [field]: value } : line));

  const subtotal = lines.reduce((sum, line) => sum + Number(line.price) * Number(line.quantity), 0);
  const lineDiscounts = lines.reduce((sum, line) => sum + Number(line.discount || 0), 0);
  const invoiceDiscountValue = Number(invoiceDiscount) || 0;
  const baseTotal = Math.max(0, subtotal - lineDiscounts);
  const remainingDiscount = Math.min(invoiceDiscountValue, baseTotal);
  const totalBase = lines.reduce((sum, line) => sum + Math.max(0, Number(line.price) * Number(line.quantity) - Number(line.discount || 0)), 0);
  let discountLeft = Math.round(remainingDiscount * 100);
  let taxTotalPaise = 0;
  lines.forEach((line, index) => {
    const basePaise = Math.round(Math.max(0, Number(line.price) * Number(line.quantity) - Number(line.discount || 0)) * 100);
    const allocatedDiscount = index === lines.length - 1
      ? discountLeft
      : totalBase > 0 ? Math.floor(Math.round(remainingDiscount * 100) * basePaise / Math.round(totalBase * 100)) : 0;
    discountLeft -= allocatedDiscount;
    taxTotalPaise += Math.round((basePaise - allocatedDiscount) * Number(line.taxRate || 0) / 100);
  });
  const invoiceTotal = Math.max(0, baseTotal - remainingDiscount) + taxTotalPaise / 100;

  const submitSale = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const stableRequestId = requestId || window.crypto.randomUUID();
      if (!requestId) setRequestId(stableRequestId);
      const response = await fetch('/api/admin/sales', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: stableRequestId,
          customer,
          lines: lines.map(line => ({ slug: line.slug, quantity: Number(line.quantity), discount: Number(line.discount || 0) })),
          invoiceDiscount: Number(invoiceDiscount || 0),
          initialPayment: Number(initialPayment || 0),
          paymentMethod,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not create this invoice.');
      window.location.assign(`/admin/vyapaar/sales/${encodeURIComponent(result.sale.invoiceNumber)}`);
    } catch (requestError) {
      setError(requestError.message || 'Could not create this invoice.');
      setSaving(false);
    }
  };

  return (
    <form className="vyapaar-sale-composer" onSubmit={submitSale}>
      <div className="vyapaar-sale-workspace">
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><span>Find in-stock products</span><h2>Items</h2></div></div>
          <div className="admin-stock-search" role="search">
            <label>Search name, SKU, or barcode<input value={productQuery} onChange={event => setProductQuery(event.target.value)} /></label>
            <button className="admin-secondary-button" type="button" onClick={() => loadProducts(productQuery.trim())}>Search</button>
          </div>
          {catalogError && <p className="admin-error" role="alert">{catalogError}</p>}
          {loadingProducts
            ? <p className="admin-loading">Loading available products…</p>
            : products.length
              ? <div className="vyapaar-product-picker">{products.map(product => {
                const selected = lines.find(line => line.slug === product.slug);
                const atStockLimit = (selected?.quantity || 0) >= product.stock;
                return <article key={product.slug}>
                  <div><b>{product.name}</b><span>{product.sku || product.barcode || product.slug} · {product.stock} {product.unit || 'piece'} in stock</span><small>{money(product.price)} · tax {product.taxRate || 0}%</small></div>
                  <button type="button" className="admin-secondary-button" onClick={() => addProduct(product)} disabled={atStockLimit}>{atStockLimit ? 'Stock limit' : 'Add'}</button>
                </article>;
              })}</div>
              : <p className="admin-empty">No in-stock, active products match. Add stock before invoicing an item.</p>}
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading"><div><span>Invoice recipient</span><h2>Customer details</h2></div></div>
          {customerError && <p className="admin-error" role="alert">{customerError}</p>}
          <div className="admin-product-form">
            <label>Saved customer<select name="partyId" value={customer.partyId} onChange={updateCustomer}>
              <option value="">New customer / enter details manually</option>
              {customers.map(party => <option key={party.id} value={party.id}>{party.name}{party.phone ? ` · ${party.phone}` : ''}</option>)}
            </select></label>
            <label>Customer name<input name="name" value={customer.name} onChange={updateCustomer} minLength={2} maxLength={100} required /></label>
            <div className="admin-form-row">
              <label>Phone<input name="phone" value={customer.phone} onChange={updateCustomer} inputMode="numeric" pattern="[0-9]{10}" maxLength={10} /></label>
              <label>Email<input name="email" type="email" value={customer.email} onChange={updateCustomer} maxLength={254} /></label>
            </div>
            <label>Address<textarea name="address" value={customer.address} onChange={updateCustomer} maxLength={500} rows={2} /></label>
            <Link className="admin-empty-link" href="/admin/vyapaar/parties">Manage saved customers →</Link>
          </div>
        </section>
      </div>

      <section className="admin-panel vyapaar-sale-lines">
        <div className="admin-panel-heading"><div><span>Server-priced invoice</span><h2>Sale items</h2></div></div>
        {lines.length
          ? <div className="vyapaar-sales-table-wrap"><table className="vyapaar-sales-table">
            <thead><tr><th>Item</th><th>Unit price</th><th>Qty</th><th>Line discount</th><th>Tax</th><th>Amount</th><th /></tr></thead>
            <tbody>{lines.map(line => {
              const gross = Number(line.price) * Number(line.quantity);
              const discount = Number(line.discount || 0);
              const amount = Math.max(0, gross - discount);
              return <tr key={line.slug}>
                <td>{line.name}</td><td>{money(line.price)}</td>
                <td><input className="vyapaar-quantity-input" type="number" min="1" max={line.stock} step="1" value={line.quantity} onChange={event => updateLine(line.slug, 'quantity', event.target.value)} required /></td>
                <td><input className="vyapaar-money-input" type="number" min="0" max={gross} step="0.01" value={line.discount} onChange={event => updateLine(line.slug, 'discount', event.target.value)} /></td>
                <td>{line.taxRate || 0}%</td><td>{money(amount)}</td>
                <td><button type="button" className="admin-danger-button" onClick={() => setLines(current => current.filter(item => item.slug !== line.slug))}>Remove</button></td>
              </tr>;
            })}</tbody>
          </table></div>
          : <p className="admin-empty">Add an item from the product list to start this invoice.</p>}
        <div className="vyapaar-sale-summary">
          <label>Invoice discount (₹)<input type="number" min="0" max={baseTotal} step="0.01" value={invoiceDiscount} onChange={event => setInvoiceDiscount(event.target.value)} /></label>
          <div><span>Subtotal</span><b>{money(subtotal)}</b><span>Discount</span><b>−{money(lineDiscounts + remainingDiscount)}</b><span>Tax</span><b>{money(taxTotalPaise / 100)}</b><strong>Total</strong><strong>{money(invoiceTotal)}</strong></div>
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading"><div><span>Payment on issue</span><h2>Record initial payment</h2></div></div>
        <div className="vyapaar-payment-entry">
          <label>Amount paid now (₹)<input type="number" min="0" max={invoiceTotal} step="0.01" value={initialPayment} onChange={event => setInitialPayment(event.target.value)} /></label>
          <label>Payment method<select value={paymentMethod} onChange={event => setPaymentMethod(event.target.value)}>
            <option value="cash">Cash</option><option value="upi">UPI</option><option value="bank-transfer">Bank transfer</option><option value="card">Card</option><option value="other">Other</option>
          </select></label>
          <span>Outstanding after payment: <b>{money(Math.max(0, invoiceTotal - (Number(initialPayment) || 0)))}</b></span>
        </div>
        {error && <p className="admin-error" role="alert">{error}</p>}
        <p className="vyapaar-disclaimer">Prices are treated as tax-exclusive. Tax is calculated from each item’s saved rate and is not a statutory GST filing calculation. Issued invoices cannot currently be cancelled or edited.</p>
        <div className="admin-editor-actions">
          <Link href="/admin/vyapaar/sales" className="admin-secondary-button">Cancel</Link>
          <button type="submit" className="admin-primary-button" disabled={saving || !lines.length}>{saving ? 'Creating invoice…' : 'Create & issue invoice'}</button>
        </div>
      </section>
    </form>
  );
}

export function SaleDetail({ invoiceNumber }) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingPayment, setSavingPayment] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [paymentRequest, setPaymentRequest] = useState('');

  const loadSale = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/sales/${encodeURIComponent(invoiceNumber)}`, { credentials: 'same-origin' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load invoice.');
      setRecord(result);
    } catch (requestError) {
      setError(requestError.message || 'Could not load invoice.');
    } finally {
      setLoading(false);
    }
  }, [invoiceNumber]);

  useEffect(() => { loadSale(); }, [loadSale]);

  const recordPayment = async event => {
    event.preventDefault();
    setSavingPayment(true);
    setError('');
    setNotice('');
    try {
      const stableRequestId = paymentRequest || window.crypto.randomUUID();
      if (!paymentRequest) setPaymentRequest(stableRequestId);
      const response = await fetch(`/api/admin/sales/${encodeURIComponent(invoiceNumber)}/payments`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: stableRequestId, amount: Number(amount), method, reference }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not record payment.');
      setRecord(current => ({ ...current, sale: result.sale }));
      setPaymentRequest('');
      setAmount('');
      setReference('');
      setNotice('Payment recorded against this invoice.');
      await loadSale();
    } catch (requestError) {
      setError(requestError.message || 'Could not record payment.');
    } finally {
      setSavingPayment(false);
    }
  };

  if (loading) return <div className="vyapaar-content"><p className="admin-loading">Loading invoice…</p></div>;
  if (!record) return <div className="vyapaar-content">{error && <p className="admin-error" role="alert">{error}</p>}<Link className="admin-secondary-button" href="/admin/vyapaar/sales">Back to sales</Link></div>;
  const { sale, payments } = record;

  return (
    <div className="vyapaar-content">
      <div className="vyapaar-page-heading">
        <span className="vyapaar-eyebrow">SALES · {sale.status.toUpperCase()}</span>
        <h1>{sale.invoiceNumber}</h1>
        <p>Issued {formatDate(sale.createdAt)} · {sale.customer.name}</p>
      </div>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {notice && <p className="admin-notice" role="status">{notice}</p>}
      <section className="admin-panel vyapaar-invoice-print" aria-label="Invoice details">
        <div className="admin-panel-heading"><div><span>{sale.business?.name || "The Gifter's Hub"} · INR</span><h2>Invoice</h2></div><button className="admin-secondary-button vyapaar-no-print" type="button" onClick={() => window.print()}>Print invoice</button></div>
        {sale.business && <div className="vyapaar-invoice-customer">
          {sale.business.phone && <span>{sale.business.phone}</span>}
          {sale.business.email && <span>{sale.business.email}</span>}
          {sale.business.address && <span>{sale.business.address}</span>}
          {sale.business.gstin && <span>GSTIN: {sale.business.gstin}</span>}
        </div>}
        <div className="vyapaar-invoice-customer"><b>{sale.customer.name}</b>{sale.customer.phone && <span>{sale.customer.phone}</span>}{sale.customer.email && <span>{sale.customer.email}</span>}{sale.customer.address && <span>{sale.customer.address}</span>}</div>
        <div className="vyapaar-sales-table-wrap"><table className="vyapaar-sales-table">
          <thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Discount</th><th>Tax rate</th><th>Tax</th><th>Total</th></tr></thead>
          <tbody>{sale.lines.map(line => <tr key={line.slug}>
            <td>{line.name}<small>{line.sku || line.slug}</small></td><td>{line.quantity} {line.unit}</td><td>{money(line.unitPrice)}</td>
            <td>{money(line.discount + line.invoiceDiscountPaise / 100)}</td><td>{line.taxRate}%</td><td>{money(line.tax)}</td><td>{money(line.total)}</td>
          </tr>)}</tbody>
        </table></div>
        <div className="vyapaar-invoice-totals"><span>Subtotal</span><b>{money(sale.subtotal)}</b><span>Discount</span><b>−{money(sale.discount)}</b><span>Tax</span><b>{money(sale.tax)}</b><strong>Total</strong><strong>{money(sale.total)}</strong><span>Paid</span><b>{money(sale.amountPaid)}</b><strong>Balance due</strong><strong>{money(sale.balanceDue)}</strong></div>
        {sale.business?.invoiceTerms && <p className="vyapaar-disclaimer">{sale.business.invoiceTerms}</p>}
        <p className="vyapaar-disclaimer">Tax is derived from the item tax rates saved at issue time. This operational invoice is not a claim of statutory GST compliance.</p>
      </section>

      <section className="admin-panel vyapaar-payments-panel">
        <div className="admin-panel-heading"><div><span>Receipts applied to invoice</span><h2>Payment history</h2></div></div>
        {payments.length
          ? <div className="vyapaar-payment-history">{payments.map(payment => <article key={payment.id}>
            <div><b>{money(payment.amount)}</b><span>{payment.method.replace('-', ' ')}{payment.reference ? ` · ${payment.reference}` : ''}</span><small>{formatDate(payment.createdAt)} · {payment.createdByEmail}</small></div>
          </article>)}</div>
          : <p className="admin-empty">No payment has been recorded for this invoice yet.</p>}
        {sale.balanceDue > 0 && <form className="vyapaar-payment-form" onSubmit={recordPayment}>
          <h3>Record another payment</h3>
          <label>Amount (₹)<input type="number" min="0.01" max={sale.balanceDue} step="0.01" value={amount} onChange={event => setAmount(event.target.value)} required /></label>
          <label>Method<select value={method} onChange={event => setMethod(event.target.value)}><option value="cash">Cash</option><option value="upi">UPI</option><option value="bank-transfer">Bank transfer</option><option value="card">Card</option><option value="other">Other</option></select></label>
          <label>Reference (optional)<input value={reference} onChange={event => setReference(event.target.value)} maxLength={120} /></label>
          <button className="admin-primary-button" type="submit" disabled={savingPayment}>{savingPayment ? 'Saving payment…' : 'Record payment'}</button>
        </form>}
      </section>
      <Link className="admin-secondary-button" href="/admin/vyapaar/sales">← Back to sales</Link>
    </div>
  );
}
