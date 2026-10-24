'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

const formatMoney = value => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(value || 0);

const PERIODS = {
  daily: 'Daily · last 30 days',
  weekly: 'Weekly · last 12 weeks',
  monthly: 'Monthly · last 12 months',
};

export default function SalesAnalyticsManager() {
  const [period, setPeriod] = useState('daily');
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async selectedPeriod => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/vyapaar/analytics?period=${selectedPeriod}`, { credentials: 'same-origin' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load sales analytics.');
      setAnalytics(result);
    } catch (loadError) {
      setError(loadError.message || 'Could not load sales analytics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(period); }, [load, period]);

  const maxRevenue = Math.max(1, ...(analytics?.series || []).map(item => item.revenue));
  const maxProductRevenue = Math.max(1, ...(analytics?.topProducts || []).map(item => item.revenue));

  return <div className="vyapaar-content">
    <section className="vyapaar-page-heading">
      <span className="vyapaar-eyebrow">BUSINESS PERFORMANCE</span>
      <h1>Sales analytics &amp; alerts</h1>
      <p>Track Vyapaar invoice sales, product performance, operational GST totals, and issues that need attention.</p>
    </section>

    <div className="sales-analytics-toolbar">
      <label>Reporting period
        <select value={period} onChange={event => setPeriod(event.target.value)}>
          {Object.entries(PERIODS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <button className="admin-secondary-button" type="button" onClick={() => load(period)} disabled={loading}>
        {loading ? 'Refreshing…' : 'Refresh'}
      </button>
    </div>
    {error && <p className="admin-error" role="alert">{error}</p>}
    {loading && !analytics && <p className="admin-loading">Loading analytics…</p>}

    {analytics && <>
      <section className="vyapaar-metrics vyapaar-report-cards sales-analytics-metrics" aria-label="Sales summary">
        <article><span>Invoice sales</span><b>{formatMoney(analytics.totals.revenue)}</b><small>{PERIODS[period]}</small></article>
        <article><span>Invoices</span><b>{analytics.totals.invoices}</b><small>Created in this period</small></article>
        <article><span>Average invoice value</span><b>{formatMoney(analytics.totals.averageOrderValue)}</b><small>Invoice sales ÷ invoice count</small></article>
        <article><span>GST recorded</span><b>{formatMoney(analytics.totals.tax)}</b><small>From invoice tax data</small></article>
      </section>

      <section className="admin-panel sales-analytics-panel">
        <div className="admin-panel-heading"><div><span>SALES TREND</span><h2>{PERIODS[period]}</h2></div></div>
        {analytics.series.some(item => item.revenue > 0)
          ? <div className={`sales-analytics-chart ${period}`} role="img" aria-label={`Invoice revenue ${PERIODS[period]}`}>
            {analytics.series.map(item => <div className="sales-analytics-bar-column" key={item.period} title={`${item.period}: ${formatMoney(item.revenue)} · ${item.invoices} invoices`}>
              <span>{item.revenue ? formatMoney(item.revenue) : ''}</span>
              <div className="sales-analytics-bar-track"><i style={{ height: `${Math.max(item.revenue ? 5 : 0, item.revenue / maxRevenue * 100)}%` }} /></div>
              <small>{period === 'daily' ? item.period.slice(5) : item.period}</small>
            </div>)}
          </div>
          : <p className="admin-empty">No sales invoices were recorded in this period.</p>}
      </section>

      <section className="sales-analytics-grid">
        <div className="admin-panel sales-analytics-panel">
          <div className="admin-panel-heading"><div><span>ITEM PERFORMANCE</span><h2>Top-selling products</h2></div></div>
          {analytics.topProducts.length
            ? <div className="sales-analytics-list">{analytics.topProducts.map((item, index) => <article key={item.slug}>
              <span className="sales-analytics-rank">{index + 1}</span>
              <div><b>{item.name}</b><small>{item.category} · {item.units} units</small><i><span style={{ width: `${Math.max(4, item.revenue / maxProductRevenue * 100)}%` }} /></i></div>
              <strong>{formatMoney(item.revenue)}</strong>
            </article>)}</div>
            : <p className="admin-empty">Product performance will appear after sales are recorded.</p>}
        </div>

        <div className="admin-panel sales-analytics-panel">
          <div className="admin-panel-heading"><div><span>IN-STOCK ITEMS</span><h2>Slow-moving products</h2></div></div>
          {analytics.slowMovers.length
            ? <div className="sales-analytics-list">{analytics.slowMovers.map(item => <article key={item.slug}>
              <span className="sales-analytics-category-mark" aria-hidden="true">↘</span>
              <div><b>{item.name}</b><small>{item.category || 'Uncategorized'} · {item.stock} in stock</small></div>
              <strong>{item.soldUnits} sold</strong>
            </article>)}</div>
            : <p className="admin-empty">No active, in-stock products to evaluate.</p>}
        </div>

        <div className="admin-panel sales-analytics-panel">
          <div className="admin-panel-heading"><div><span>CATEGORY PERFORMANCE</span><h2>Sales by category</h2></div></div>
          {analytics.categories.length
            ? <div className="sales-analytics-list">{analytics.categories.map(item => <article key={item.name}>
              <span className="sales-analytics-category-mark" aria-hidden="true">▦</span>
              <div><b>{item.name}</b><small>{item.units} units sold</small></div>
              <strong>{formatMoney(item.revenue)}</strong>
            </article>)}</div>
            : <p className="admin-empty">Category performance will appear after sales are recorded.</p>}
        </div>
      </section>

      <section className="sales-analytics-grid">
        <div className="admin-panel sales-analytics-panel">
          <div className="admin-panel-heading"><div><span>GST BREAKDOWN</span><h2>Tax recorded by rate</h2></div></div>
          {analytics.taxByRate.length
            ? <div className="sales-analytics-tax">{analytics.taxByRate.map(item => <article key={item.rate}><span>{item.rate}% GST</span><b>{formatMoney(item.tax)}</b></article>)}
              <strong><span>Total recorded GST</span><b>{formatMoney(analytics.totals.tax)}</b></strong>
            </div>
            : <p className="admin-empty">No GST line data is available for this period.</p>}
          <p className="vyapaar-disclaimer">Operational estimate from issued invoice line tax. Not a statutory GST return or tax filing.</p>
        </div>

        <div className="admin-panel sales-analytics-panel">
          <div className="admin-panel-heading"><div><span>LIVE CHECKS</span><h2>Alerts</h2></div><span className="sales-analytics-alert-count">{analytics.alerts.length}</span></div>
          {analytics.alerts.length
            ? <div className="sales-analytics-alerts">{analytics.alerts.map(alert => <Link href={alert.href} key={alert.id}>
              <span aria-hidden="true">!</span><div><b>{alert.title}</b><small>{alert.detail}</small></div><i aria-hidden="true">→</i>
            </Link>)}</div>
            : <p className="sales-analytics-all-clear">No current alerts. Inventory and recorded sales are within the configured checks.</p>}
          <p className="vyapaar-disclaimer">Alert rules: stock at/below reorder level; sales down 30% week-over-week; unpaid invoices older than 30 days; return credits at least 10% of sales value in the last 30 days.</p>
        </div>
      </section>
      <p className="vyapaar-disclaimer">{analytics.disclaimer} Categories for historical invoices without saved category snapshots use the current product category.</p>
    </>}
    <div className="sales-analytics-links"><Link href="/admin/vyapaar/reports">Open operational reports →</Link><Link href="/admin/vyapaar/sales">Manage invoices →</Link></div>
  </div>;
}
