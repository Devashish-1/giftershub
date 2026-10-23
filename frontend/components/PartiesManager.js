'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

const EMPTY_PARTY = { name: '', type: 'customer', phone: '', email: '', address: '', gstin: '', notes: '' };

function PageControls({ page, total, pageSize, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="admin-pagination">
      <span>Page {page} of {pages}</span>
      <div><button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1}>Previous</button><button type="button" onClick={() => onChange(page + 1)} disabled={page >= pages}>Next</button></div>
    </div>
  );
}

export default function PartiesManager() {
  const [collection, setCollection] = useState({ items: [], page: 1, pageSize: 25, total: 0 });
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(undefined);
  const [form, setForm] = useState(EMPTY_PARTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadParties = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), q: query, type });
      const response = await fetch(`/api/admin/parties?${params}`, { credentials: 'same-origin' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load parties.');
      setCollection(result);
    } catch (requestError) {
      setError(requestError.message || 'Could not load parties.');
    } finally {
      setLoading(false);
    }
  }, [page, query, type]);

  useEffect(() => { loadParties(); }, [loadParties]);

  const openEditor = party => {
    setEditing(party || null);
    setForm(party ? {
      name: party.name || '', type: party.type || 'customer', phone: party.phone || '',
      email: party.email || '', address: party.address || '', gstin: party.gstin || '', notes: party.notes || '',
    } : EMPTY_PARTY);
  };

  const saveParty = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(editing ? `/api/admin/parties/${encodeURIComponent(editing.id)}` : '/api/admin/parties', {
        method: editing ? 'PUT' : 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save party.');
      setEditing(undefined);
      setNotice(editing ? 'Party details updated.' : 'Party added.');
      await loadParties();
    } catch (requestError) {
      setError(requestError.message || 'Could not save party.');
    } finally {
      setSaving(false);
    }
  };

  const archiveParty = async party => {
    if (!window.confirm(`Archive ${party.name}? Existing invoice records will be preserved.`)) return;
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/admin/parties/${encodeURIComponent(party.id)}`, { method: 'DELETE', credentials: 'same-origin' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not archive party.');
      setNotice('Party archived. Historical invoice records are unchanged.');
      await loadParties();
    } catch (requestError) {
      setError(requestError.message || 'Could not archive party.');
    }
  };

  const search = event => {
    event.preventDefault();
    setPage(1);
    setQuery(queryInput.trim());
  };

  return (
    <div className="vyapaar-content">
      <section className="vyapaar-page-heading">
        <span className="vyapaar-eyebrow">CONTACTS</span>
        <h1>Customers &amp; suppliers</h1>
        <p>Keep reusable customer and supplier records. Issued invoices preserve the contact details captured when they were created.</p>
      </section>
      <section className="admin-panel vyapaar-sales-panel">
        <div className="admin-panel-heading">
          <div><span>Customer and supplier directory</span><h2>Parties</h2><span>{collection.total} records</span></div>
          <button className="admin-primary-button" type="button" onClick={() => openEditor(null)}>+ Add party</button>
        </div>
        <form className="admin-order-filters" onSubmit={search}>
          <label>Search party<input value={queryInput} onChange={event => setQueryInput(event.target.value)} placeholder="Name, phone, email or GSTIN" /></label>
          <label>Party type<select value={type} onChange={event => { setPage(1); setType(event.target.value); }}>
            <option value="">All parties</option><option value="customer">Customers</option><option value="supplier">Suppliers</option><option value="both">Both</option>
          </select></label>
          <button className="admin-secondary-button" type="submit">Search</button>
        </form>
        {error && <p className="admin-error" role="alert">{error}</p>}
        {notice && <p className="admin-notice" role="status">{notice}</p>}
        {loading ? <p className="admin-loading">Loading parties…</p> : collection.items.length
          ? <>
            <div className="vyapaar-sales-table-wrap"><table className="vyapaar-sales-table">
              <thead><tr><th>Party name</th><th>Type</th><th>Phone</th><th>Email</th><th>GSTIN</th><th>Actions</th></tr></thead>
              <tbody>{collection.items.map(party => <tr key={party.id}>
                <td>{party.name}</td><td className="vyapaar-party-type">{party.type}</td><td>{party.phone || '—'}</td><td>{party.email || '—'}</td><td>{party.gstin || '—'}</td>
                <td><div className="admin-product-actions"><button className="admin-secondary-button" type="button" onClick={() => openEditor(party)}>Edit</button><button className="admin-danger-button" type="button" onClick={() => archiveParty(party)}>Archive</button></div></td>
              </tr>)}</tbody>
            </table></div>
            {collection.total > collection.pageSize && <PageControls page={collection.page} total={collection.total} pageSize={collection.pageSize} onChange={setPage} />}
          </>
          : <p className="admin-empty">{query || type ? 'No parties match these filters.' : 'No parties yet. Add customers or suppliers for reuse on transactions.'}</p>}
      </section>
      {editing !== undefined && <div className="admin-editor-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setEditing(undefined); }}>
        <section className="admin-product-editor" role="dialog" aria-modal="true" aria-labelledby="vyapaar-party-title">
          <div className="admin-panel-heading"><div><span>Business contacts</span><h2 id="vyapaar-party-title">{editing ? 'Edit party' : 'Add party'}</h2></div><button className="admin-icon-button" type="button" onClick={() => setEditing(undefined)} aria-label="Close">×</button></div>
          <form className="admin-product-form" onSubmit={saveParty}>
            <label>Party name<input value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} minLength={2} maxLength={120} required /></label>
            <label>Party type<select value={form.type} onChange={event => setForm(current => ({ ...current, type: event.target.value }))}><option value="customer">Customer</option><option value="supplier">Supplier</option><option value="both">Customer &amp; supplier</option></select></label>
            <div className="admin-form-row">
              <label>Phone (10 digits)<input value={form.phone} onChange={event => setForm(current => ({ ...current, phone: event.target.value }))} inputMode="numeric" pattern="[0-9]{10}" maxLength={10} /></label>
              <label>Email<input type="email" value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} maxLength={254} /></label>
            </div>
            <label>Address<textarea value={form.address} onChange={event => setForm(current => ({ ...current, address: event.target.value }))} maxLength={500} rows={2} /></label>
            <label>GSTIN<input value={form.gstin} onChange={event => setForm(current => ({ ...current, gstin: event.target.value }))} maxLength={15} /></label>
            <label>Notes<textarea value={form.notes} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} maxLength={1000} rows={3} /></label>
            <div className="admin-editor-actions">
              <button className="admin-secondary-button" type="button" onClick={() => setEditing(undefined)}>Cancel</button>
              <button className="admin-primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add party'}</button>
            </div>
          </form>
        </section>
      </div>}
      <Link className="admin-empty-link" href="/admin/vyapaar/sales/new">Create an invoice →</Link>
    </div>
  );
}
