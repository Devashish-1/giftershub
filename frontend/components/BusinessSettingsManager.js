'use client';

import { useCallback, useEffect, useState } from 'react';

const DEFAULTS = {
  businessName: "The Gifter's Hub",
  phone: '',
  email: '',
  address: '',
  gstin: '',
  currency: 'INR',
  invoicePrefix: 'GH-INV',
  invoiceTerms: 'Thank you for your business.',
};

export default function BusinessSettingsManager() {
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/settings/business', { credentials: 'same-origin' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load business settings.');
      setSettings({ ...DEFAULTS, ...result.settings });
    } catch (requestError) {
      setError(requestError.message || 'Could not load business settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const update = event => setSettings(current => ({ ...current, [event.target.name]: event.target.value }));
  const save = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/settings/business', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save business settings.');
      setSettings({ ...DEFAULTS, ...result.settings });
      setNotice('Business and invoice settings saved.');
    } catch (requestError) {
      setError(requestError.message || 'Could not save business settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="vyapaar-content">
      <section className="vyapaar-page-heading">
        <span className="vyapaar-eyebrow">PREFERENCES</span>
        <h1>Business settings</h1>
        <p>Set the business details and invoice identifiers shown on new Vyapaar invoices.</p>
      </section>
      {loading ? <p className="admin-loading">Loading business settings…</p> : <form className="admin-panel vyapaar-business-settings" onSubmit={save}>
        <div className="admin-panel-heading"><div><span>PROFILE &amp; DOCUMENTS</span><h2>Business profile</h2></div></div>
        <div className="admin-product-form">
          <label>Business name<input name="businessName" value={settings.businessName} onChange={update} minLength={2} maxLength={100} required /></label>
          <div className="admin-form-row">
            <label>Business phone<input name="phone" value={settings.phone} onChange={update} maxLength={20} /></label>
            <label>Business email<input name="email" type="email" value={settings.email} onChange={update} maxLength={254} /></label>
          </div>
          <label>Business address<textarea name="address" value={settings.address} onChange={update} maxLength={500} rows={3} /></label>
          <div className="admin-form-row">
            <label>GSTIN (optional)<input name="gstin" value={settings.gstin} onChange={update} maxLength={15} /></label>
            <label>Business currency<select value="INR" disabled><option value="INR">INR · Indian Rupee</option></select></label>
          </div>
        </div>
        <div className="admin-panel-heading vyapaar-settings-subheading"><div><span>INVOICE NUMBERING &amp; PRINT</span><h2>Invoice preferences</h2></div></div>
        <div className="admin-product-form">
          <label>Invoice prefix<input name="invoicePrefix" value={settings.invoicePrefix} onChange={update} minLength={2} maxLength={12} pattern="[A-Za-z0-9-]{2,12}" required /><small>New invoices use this prefix, date, and a unique server-generated identifier.</small></label>
          <label>Invoice terms and conditions<textarea name="invoiceTerms" value={settings.invoiceTerms} onChange={update} maxLength={1000} rows={3} /></label>
        </div>
        <div className="vyapaar-settings-note"><b>Inventory behavior</b><span>Sales cannot reduce stock below zero. Stock is adjusted through the transaction ledger; this safety rule is not configurable.</span></div>
        <div className="vyapaar-settings-note"><b>Tax configuration</b><span>Item tax rates are editable in the item form. Invoice tax is operational only and does not calculate statutory GST components or file returns.</span></div>
        {error && <p className="admin-error" role="alert">{error}</p>}
        {notice && <p className="admin-notice" role="status">{notice}</p>}
        <div className="admin-editor-actions"><button className="admin-primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save business settings'}</button></div>
      </form>}
      {error && loading && <p className="admin-error" role="alert">{error}</p>}
    </div>
  );
}
