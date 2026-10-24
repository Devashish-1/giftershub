'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

function money(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

export default function VyapaarOverview() {
  const [overview, setOverview] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [alertError, setAlertError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [alertsLoading, setAlertsLoading] = useState(true);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/overview?usersPage=1&ordersPage=1', { credentials: 'same-origin' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load business overview.');
      setOverview(result);
    } catch (requestError) {
      setError(requestError.message || 'Could not load business overview.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAlerts = useCallback(async () => {
    setAlertsLoading(true);
    setAlertError('');
    try {
      const response = await fetch('/api/admin/vyapaar/alerts', { credentials: 'same-origin' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load business alerts.');
      setAlerts(result.alerts);
    } catch (requestError) {
      setAlertError(requestError.message || 'Could not load business alerts.');
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  useEffect(() => { loadOverview(); }, [loadOverview]);
  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  return (
    <div className="vyapaar-content">
      <section className="vyapaar-welcome">
        <div><span className="vyapaar-eyebrow">THE GIFTERS HUB · BUSINESS</span><h1>Your business, at a glance.</h1><p>Manage inventory, supplier purchases, sales invoices and business contacts in one place.</p></div>
        <Link className="admin-primary-button" href="/admin/vyapaar/items">Manage inventory <span aria-hidden="true">→</span></Link>
      </section>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {loading && !overview
        ? <p className="admin-loading">Loading business overview…</p>
        : overview && <>
          <section className="vyapaar-metrics" aria-label="Key business indicators">
            <article><span>Catalogue items</span><b>{overview.summary.productCount ?? 0}</b><small>Active: {overview.summary.activeProductCount ?? 0}</small></article>
            <article><span>Stock on hand</span><b>{overview.summary.stockUnits ?? 0}</b><small>Total tracked units</small></article>
            <Link href="/admin/vyapaar/stock" className={overview.summary.lowStockCount > 0 ? 'vyapaar-metric-alert' : ''}><span>Low-stock items</span><b>{overview.summary.lowStockCount ?? 0}</b><small>Review inventory levels →</small></Link>
            <article><span>Sales invoices</span><b>{overview.summary.invoiceCount}</b><small>Issued in Vyapaar</small></article>
            <article><span>Customer receivables</span><b>{money(overview.summary.receivables)}</b><small>Unpaid invoice balances</small></article>
            <article><span>Supplier payables</span><b>{money(overview.summary.payables)}</b><small>Unpaid purchase balances</small></article>
          </section>
          <details className="vyapaar-more-metrics">
            <summary>More business metrics</summary>
            <div className="vyapaar-secondary-metrics">
              <article><span>Orders</span><b>{overview.summary.orderCount}</b><small>All-time order count</small></article>
              <article><span>Recorded order value</span><b>{money(overview.summary.orderValue)}</b><small>All-time; not accounting revenue</small></article>
              <article><span>Payments pending</span><b>{overview.summary.pendingPayments}</b><small>Order payment records</small></article>
              <article><span>Registered customers</span><b>{overview.summary.userCount}</b><small>Customer accounts</small></article>
              <article><span>Recorded sales</span><b>{money(overview.summary.salesValue)}</b><small>Invoice totals, INR</small></article>
              <article><span>Supplier purchases</span><b>{overview.summary.purchaseCount ?? 0}</b><small>{money(overview.summary.purchaseValue)} recorded</small></article>
              <article><span>Saved customers</span><b>{overview.summary.partyCustomerCount ?? 0}</b><small>Reusable contact records</small></article>
              <article><span>Saved suppliers</span><b>{overview.summary.supplierCount ?? 0}</b><small>Reusable contact records</small></article>
            </div>
          </details>
          <section className="sales-analytics-dashboard-alerts">
            <div className="vyapaar-section-heading"><div><span className="vyapaar-eyebrow">BUSINESS HEALTH</span><h2>Alerts</h2></div><Link href="/admin/vyapaar/analytics">Analytics →</Link></div>
            {alertError && <p className="admin-error" role="alert">{alertError}</p>}
            {alertsLoading
              ? <p className="admin-loading">Checking alerts…</p>
              : alerts.length
                ? <div className="sales-analytics-alerts">{alerts.map(alert => <Link href={alert.href} key={alert.id}>
                  <span aria-hidden="true">!</span><div><b>{alert.title}</b><small>{alert.detail}</small></div><i aria-hidden="true">→</i>
                </Link>)}</div>
                : !alertError && <p className="sales-analytics-all-clear">No current alerts. Inventory and recorded sales are within the configured checks.</p>}
            <p className="vyapaar-disclaimer">Checks: reorder levels, 30% weekly sales drop, invoices unpaid over 30 days, and 10% sales-return rate.</p>
          </section>
          <section className="vyapaar-quick-actions" aria-labelledby="vyapaar-actions-title">
            <div className="vyapaar-section-heading"><span className="vyapaar-eyebrow">COMMON TASKS</span><h2 id="vyapaar-actions-title">Quick actions</h2></div>
            <div className="vyapaar-action-grid">
              <Link href="/admin/vyapaar/items">Manage inventory</Link>
              <Link href="/admin/vyapaar/stock">Adjust stock</Link>
              <Link href="/admin/vyapaar/sales/new">Create a sale / invoice</Link>
              <Link href="/admin/vyapaar/purchases">Record a purchase</Link>
              <Link href="/admin/vyapaar/returns">Record a return</Link>
            </div>
          </section>
          <section className="vyapaar-recent">
            <div className="vyapaar-section-heading"><div><span className="vyapaar-eyebrow">LATEST ACTIVITY</span><h2>Recent orders</h2></div><Link href="/admin">View all orders →</Link></div>
            {overview.orders.items.length
              ? <div className="vyapaar-recent-list">{overview.orders.items.slice(0, 5).map(order => (
                <article key={order.id}><div><b>{order.orderId}</b><span>{order.email}</span></div><span className="vyapaar-order-state">{order.status}</span><b>{money(order.total)}</b></article>
              ))}</div>
              : <p className="admin-empty">No order records yet. Order activity will appear here when available.</p>}
          </section>
          <p className="vyapaar-disclaimer">Order and transaction totals are operational summaries, not formal accounting or tax reports. Returns, expenses, cashbook entries and reports are operational tools, not statutory GST/accounting filings.</p>
        </>}
    </div>
  );
}
