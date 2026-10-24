'use client';

import { useCallback, useEffect, useState } from 'react';

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(date);
}

async function request(path, options) {
  const response = await fetch(path, { credentials: 'same-origin', ...options });
  const result = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(result?.error || 'The request could not be completed.');
  return result;
}

export default function AdminCouponManager() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ code: '', value: '10' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems((await request('/api/admin/coupons')).items);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createCoupon = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const coupon = await request('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: form.code, value: Number(form.value) }),
      });
      setForm({ code: '', value: '10' });
      setNotice(`${coupon.code} saved as a draft.`);
      await load();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const removeDraft = async code => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await request(`/api/admin/coupons/${encodeURIComponent(code)}`, { method: 'DELETE' });
      setNotice(`${code} draft removed.`);
      await load();
    } catch (removeError) {
      setError(removeError.message);
    } finally {
      setSaving(false);
    }
  };

  return <div className="admin-coupon-manager">
    <header className="admin-page-heading">
      <div><span className="eyebrow">PROMOTIONS</span><h1>Coupons</h1><p>Create percentage coupon drafts. Redemption stays disabled until eligibility rules are decided; live discounts are capped to preserve a 10% gross margin after GST and conservatively recorded item costs.</p></div>
    </header>
    {error && <p className="admin-error" role="alert">{error}</p>}
    {notice && <p className="admin-notice" role="status">{notice}</p>}
    <section className="admin-panel">
      <div className="admin-panel-heading"><div><span>NEW PROMOTION</span><h2>Create percentage coupon</h2></div></div>
      <form className="admin-product-form admin-coupon-form" onSubmit={createCoupon}>
        <div className="admin-form-row">
          <label>Coupon code<input value={form.code} onChange={event => setForm(current => ({ ...current, code: event.target.value.toUpperCase() }))} minLength={3} maxLength={30} pattern="[A-Za-z0-9_-]{3,30}" autoCapitalize="characters" required /></label>
          <label>Discount (%)<input type="number" value={form.value} onChange={event => setForm(current => ({ ...current, value: event.target.value }))} min="1" max="100" step="0.01" required /></label>
        </div>
        <button className="admin-primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save coupon draft'}</button>
      </form>
    </section>
    <section className="admin-panel">
      <div className="admin-panel-heading"><div><span>COUPON REGISTER</span><h2>All coupon codes</h2></div></div>
      {loading ? <p className="admin-loading">Loading coupons…</p> : items.length ? <div className="admin-coupon-list">
        {items.map(item => <article className="admin-coupon-row" key={item.code}>
          <div><b>{item.code}</b><span>{item.value}% off</span><small>{item.status === 'draft' ? 'Eligibility not configured · not redeemable' : `Active · created ${formatDate(item.createdAt)}`}</small></div>
          <strong>{item.status === 'draft' ? 'Draft' : 'Active'}</strong>
          {item.status === 'draft' && <button type="button" className="admin-secondary-button" disabled={saving} onClick={() => removeDraft(item.code)}>Remove draft</button>}
        </article>)}
      </div> : <p className="admin-empty">No coupons have been created.</p>}
    </section>
    <p className="admin-payment-note">Active codes: GIFTHUB10 and UPI5. Newly created coupons remain drafts and are not applied at checkout until eligibility is configured. Add accurate pre-GST purchase prices and other landed unit costs; purchase GST is conservatively included, and items without purchase cost data cannot receive coupon discounts.</p>
  </div>;
}
