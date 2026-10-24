'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../components/AuthProvider';
import AdminProductManager from '../../components/AdminProductManager';
import AdminCouponManager from '../../components/AdminCouponManager';

const ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];
const TABS = [
  ['overview', 'Overview'],
  ['products', 'Products'],
  ['coupons', 'Coupons'],
  ['orders', 'Orders'],
  ['customers', 'Customers'],
];

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function money(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
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

function OrderList({ orders, busyOrder, updateOrder }) {
  if (!orders.length) return <p className="admin-empty">No orders match these filters.</p>;

  return (
    <div className="admin-order-list">{orders.map(order => (
      <article className="admin-order" key={order.id}>
        <div className="admin-order-heading">
          <div><b>{order.orderId}</b><span>{formatDate(order.createdAt)}</span></div>
          <strong>{money(order.total)}</strong>
        </div>
        <div className="admin-order-details">
          <div><b>{order.customer?.name || order.email}</b><span>{order.email}</span><span>{order.customer?.phone || 'No phone'}</span></div>
          <div><b>Delivery address</b><span>{order.customer?.address || 'Not provided'}</span><span>PIN {order.customer?.pincode || '—'}</span></div>
          <div><b>Items</b>{order.lines?.map(line => <span key={line.slug}>{line.name} × {line.qty}</span>)}</div>
        </div>
        <div className="admin-order-controls">
          <label>Order status
            <select value={order.status} disabled={busyOrder === order.orderId} onChange={event => updateOrder(order.orderId, { status: event.target.value })}>
              {ORDER_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <label>Payment ({order.paymentMethod.replaceAll('-', ' ')})
            <select value={order.paymentStatus} disabled={busyOrder === order.orderId} onChange={event => updateOrder(order.orderId, { paymentStatus: event.target.value })}>
              {PAYMENT_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          {busyOrder === order.orderId && <span className="admin-saving">Saving…</span>}
        </div>
      </article>
    ))}</div>
  );
}

function Customers({ customers, page, total, pageSize, onPageChange }) {
  return (
    <section className="admin-panel" aria-labelledby="admin-customers-title">
      <div className="admin-panel-heading">
        <div><span>People</span><h2 id="admin-customers-title">Customers</h2><span>{total} total accounts</span></div>
        <PageControls page={page} total={total} pageSize={pageSize} onChange={onPageChange} />
      </div>
      {customers.length
        ? <div className="admin-user-list">{customers.map(customer => (
          <article className="admin-user" key={customer.id}>
            <div><b>{customer.name || 'Customer'}</b><span>{customer.email}</span></div>
            <span>{customer.role === 'admin' ? 'Administrator' : 'Customer'}</span>
            <time dateTime={customer.createdAt}>{formatDate(customer.createdAt)}</time>
          </article>
        ))}</div>
        : <p className="admin-empty">No customer accounts found.</p>}
    </section>
  );
}

export default function AdminPage() {
  const { user, loading, openLogin } = useAuth();
  const [tab, setTab] = useState('overview');
  const [pages, setPages] = useState({ users: 1, orders: 1 });
  const [data, setData] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [busyOrder, setBusyOrder] = useState('');
  const [error, setError] = useState('');
  const [orderStatus, setOrderStatus] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [debouncedOrderSearch, setDebouncedOrderSearch] = useState('');

  useEffect(() => {
    if (!loading && !user) openLogin();
  }, [loading, user, openLogin]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedOrderSearch(orderSearch.trim());
      setPages(current => ({ ...current, orders: 1 }));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [orderSearch]);

  const loadOverview = useCallback(async () => {
    setLoadingData(true);
    setError('');
    try {
      const query = new URLSearchParams({
        usersPage: String(pages.users),
        ordersPage: String(pages.orders),
        ordersStatus: orderStatus,
        ordersQuery: debouncedOrderSearch,
      });
      const response = await fetch(`/api/admin/overview?${query}`, { credentials: 'same-origin' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load the admin dashboard.');
      setData(result);
    } catch (requestError) {
      setError(requestError.message || 'Could not load the admin dashboard.');
    } finally {
      setLoadingData(false);
    }
  }, [pages, orderStatus, debouncedOrderSearch]);

  useEffect(() => {
    if (user?.role === 'admin') loadOverview();
  }, [user, loadOverview]);

  const updateOrder = async (orderId, changes) => {
    setBusyOrder(orderId);
    setError('');
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not update the order.');
      await loadOverview();
    } catch (requestError) {
      setError(requestError.message || 'Could not update the order.');
    } finally {
      setBusyOrder('');
    }
  };

  if (loading || !user) {
    return <div className="wrap admin-page"><p>Checking administrator access…</p></div>;
  }

  return (
    <div className="wrap admin-page">
      <header className="admin-hero">
        <div>
          <div className="eyebrow">The Gifter’s Hub · Store operations</div>
          <h1>Good to see you, {user.name?.split(' ')[0] || 'admin'}.</h1>
          <p>Keep your catalogue, orders, and customers in one place.</p>
        </div>
        <div className="admin-hero-side">
          <span className="admin-badge">Administrator</span>
          <Link href="/admin/vyapaar" className="admin-store-link">Open Vyapaar <span aria-hidden="true">→</span></Link>
          <Link href="/" className="admin-store-link">View store <span aria-hidden="true">↗</span></Link>
        </div>
      </header>

      {error && <p className="admin-error" role="alert">{error}</p>}
      {user.role !== 'admin'
        ? <p className="admin-denied">Administrator access is required for this dashboard.</p>
        : <>
          {data && <section className="admin-stats" aria-label="Store overview">
            <article><span>Products</span><b>{data.summary.productCount ?? 0}</b><small>{data.summary.activeProductCount ?? 0} active</small></article>
            <article><span>Orders</span><b>{data.summary.orderCount}</b><small>All-time orders</small></article>
            <article><span>Order value</span><b>{money(data.summary.orderValue)}</b><small>Across all orders</small></article>
            <article><span>Payments pending</span><b>{data.summary.pendingPayments}</b><small>Need attention</small></article>
            <article><span>Customers</span><b>{data.summary.userCount}</b><small>Registered accounts</small></article>
          </section>}

          <nav className="admin-tabs" aria-label="Admin sections">
            {TABS.map(([value, label]) => <button
              className={tab === value ? 'active' : ''}
              type="button"
              key={value}
              aria-current={tab === value ? 'page' : undefined}
              onClick={() => setTab(value)}
            >{label}</button>)}
          </nav>

          {loadingData && !data
            ? <p className="admin-loading">Loading store data…</p>
            : data && <>
              {tab === 'overview' && <section className="admin-panel" aria-labelledby="admin-recent-orders-title">
                <div className="admin-panel-heading">
                  <div><span>Latest activity</span><h2 id="admin-recent-orders-title">Recent orders</h2></div>
                  <button className="admin-secondary-button" type="button" onClick={() => setTab('orders')}>Manage orders →</button>
                </div>
                <OrderList orders={data.orders.items.slice(0, 5)} busyOrder={busyOrder} updateOrder={updateOrder} />
                {!data.orders.items.length && <Link className="admin-empty-link" href="/shop">Explore the product catalogue →</Link>}
              </section>}

              {tab === 'orders' && <section className="admin-panel" aria-labelledby="admin-orders-title">
                <div className="admin-panel-heading">
                  <div><span>Fulfilment and payments</span><h2 id="admin-orders-title">Orders</h2><span>{data.orders.total} matching orders</span></div>
                  <PageControls
                    page={data.orders.page}
                    total={data.orders.total}
                    pageSize={data.orders.pageSize}
                    onChange={page => setPages(current => ({ ...current, orders: page }))}
                  />
                </div>
                <div className="admin-order-filters">
                  <label>Search orders<input value={orderSearch} onChange={event => setOrderSearch(event.target.value)} placeholder="Order ID, name, or email" /></label>
                  <label>Order status<select value={orderStatus} onChange={event => { setOrderStatus(event.target.value); setPages(current => ({ ...current, orders: 1 })); }}>
                    <option value="">All statuses</option>
                    {ORDER_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                  </select></label>
                </div>
                <OrderList orders={data.orders.items} busyOrder={busyOrder} updateOrder={updateOrder} />
              </section>}

              {tab === 'products' && <AdminProductManager />}
              {tab === 'coupons' && <AdminCouponManager />}
              {tab === 'customers' && <Customers
                customers={data.users.items}
                page={data.users.page}
                total={data.users.total}
                pageSize={data.users.pageSize}
                onPageChange={page => setPages(current => ({ ...current, users: page }))}
              />}
            </>}
        </>}
      <p className="admin-payment-note">Payment status is recorded for order management. Online payment collection is not enabled yet.</p>
    </div>
  );
}
