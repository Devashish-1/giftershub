'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../components/AuthProvider';

const ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];

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

export default function AdminPage() {
  const { user, loading, openLogin } = useAuth();
  const [pages, setPages] = useState({ users: 1, orders: 1 });
  const [data, setData] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [busyOrder, setBusyOrder] = useState('');
  const [error, setError] = useState('');

  const loadOverview = useCallback(async () => {
    setLoadingData(true);
    setError('');
    try {
      const query = new URLSearchParams({
        usersPage: String(pages.users),
        ordersPage: String(pages.orders),
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
  }, [pages]);

  useEffect(() => {
    if (!loading && !user) openLogin();
  }, [loading, user, openLogin]);

  useEffect(() => {
    if (user) loadOverview();
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
      <div className="admin-heading">
        <div>
          <div className="eyebrow">The Gifter’s Hub</div>
          <h1>Admin dashboard</h1>
          <p>Manage customer accounts, orders, and payment records.</p>
        </div>
        {user.role === 'admin' && <span className="admin-badge">Administrator</span>}
      </div>

      {error && <p className="admin-error" role="alert">{error}</p>}
      {user.role !== 'admin' && !loadingData
        ? <p className="admin-denied">Administrator access is required for this dashboard.</p>
        : loadingData && !data
          ? <p className="admin-loading">Loading account and order data…</p>
          : data && <>
            <section className="admin-stats" aria-label="Store overview">
              <article><span>Customer accounts</span><b>{data.summary.userCount}</b></article>
              <article><span>Orders</span><b>{data.summary.orderCount}</b></article>
              <article><span>Total order value</span><b>₹{Number(data.summary.orderValue).toLocaleString('en-IN')}</b></article>
              <article><span>Payments pending</span><b>{data.summary.pendingPayments}</b></article>
            </section>

            <section className="admin-panel" aria-labelledby="admin-orders-title">
              <div className="admin-panel-heading">
                <div><h2 id="admin-orders-title">Orders &amp; payments</h2><span>{data.orders.total} total orders</span></div>
                <PageControls
                  page={data.orders.page}
                  total={data.orders.total}
                  pageSize={data.orders.pageSize}
                  onChange={page => setPages(current => ({ ...current, orders: page }))}
                />
              </div>
              {data.orders.items.length ? (
                <div className="admin-order-list">{data.orders.items.map(order => (
                  <article className="admin-order" key={order.id}>
                    <div className="admin-order-heading">
                      <div><b>{order.orderId}</b><span>{formatDate(order.createdAt)}</span></div>
                      <strong>₹{Number(order.total || 0).toLocaleString('en-IN')}</strong>
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
              ) : <p className="admin-empty">No orders have been placed yet.</p>}
            </section>

            <section className="admin-panel" aria-labelledby="admin-users-title">
              <div className="admin-panel-heading">
                <div><h2 id="admin-users-title">Customers</h2><span>{data.users.total} total accounts</span></div>
                <PageControls
                  page={data.users.page}
                  total={data.users.total}
                  pageSize={data.users.pageSize}
                  onChange={page => setPages(current => ({ ...current, users: page }))}
                />
              </div>
              {data.users.items.length
                ? <div className="admin-user-list">{data.users.items.map(customer => (
                  <article className="admin-user" key={customer.id}>
                    <div><b>{customer.name || 'Customer'}</b><span>{customer.email}</span></div>
                    <span>{customer.role === 'admin' ? 'Administrator' : 'Customer'}</span>
                    <time dateTime={customer.createdAt}>{formatDate(customer.createdAt)}</time>
                  </article>
                ))}</div>
                : <p className="admin-empty">No customer accounts found.</p>}
            </section>
          </>}
      <p className="admin-payment-note">Payment status is recorded for order management. Online payment collection is not enabled yet.</p>
    </div>
  );
}
