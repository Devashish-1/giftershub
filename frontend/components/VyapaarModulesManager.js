'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const formatMoney = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value || 0);
const formatDate = value => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const requestId = () => window.crypto.randomUUID();

async function api(path, options) {
  const response = await fetch(path, { credentials: 'same-origin', ...options });
  const result = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(result?.error || 'The request could not be completed.');
  return result;
}

function useAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const result = await api('/api/admin/vyapaar/accounts');
      setAccounts(result.items);
      setError('');
    } catch (loadError) {
      setError(loadError.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  return { accounts, load, error };
}

function AccountOptions({ accounts }) {
  return accounts.map(account => <option key={account.id} value={account.id}>{account.name} · {account.type}</option>);
}

function Banner({ error, notice }) {
  return <>{error && <p className="admin-error" role="alert">{error}</p>}{notice && <p className="admin-notice" role="status">{notice}</p>}</>;
}

export function CashbookManager() {
  const { accounts, load: loadAccounts, error: accountError } = useAccounts();
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState({ direction: 'in', accountId: 'cash-default', fromAccountId: 'cash-default', toAccountId: 'bank-default', amount: '', description: '', reference: '' });
  const [newAccount, setNewAccount] = useState({ name: '', type: 'cash', openingBalance: '0' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await api('/api/admin/vyapaar/cashbook');
      setEntries(result.items);
    } catch (loadError) {
      setError(loadError.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await api('/api/admin/vyapaar/cashbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: Number(form.amount), requestId: requestId() }),
      });
      setForm(current => ({ ...current, amount: '', description: '', reference: '' }));
      setNotice(form.direction === 'transfer' ? 'Transfer recorded in both account ledgers.' : 'Cashbook entry recorded.');
      await Promise.all([load(), loadAccounts()]);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSaving(false);
    }
  };

  const createAccount = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const created = await api('/api/admin/vyapaar/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newAccount, openingBalance: Number(newAccount.openingBalance) }),
      });
      setNewAccount({ name: '', type: 'cash', openingBalance: '0' });
      setForm(current => ({ ...current, accountId: created.id, fromAccountId: created.id }));
      setNotice(`Account ${created.name} created with its opening balance.`);
      await loadAccounts();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSaving(false);
    }
  };

  return <div className="vyapaar-content">
    <section className="vyapaar-page-heading"><span className="vyapaar-eyebrow">MONEY MOVEMENT</span><h1>Cash &amp; bank</h1><p>Track new cash and bank/UPI activity, transfers, and opening balances. Balances before this ledger was introduced need to be entered as opening balances.</p></section>
    <Banner error={error || accountError} notice={notice} />
    <section className="vyapaar-metrics vyapaar-account-cards">{accounts.map(account => <article key={account.id}><span>{account.name} · {account.type}</span><b>{formatMoney(account.balancePaise / 100)}</b><small>Opening: {formatMoney(account.openingBalancePaise / 100)}</small></article>)}</section>
    <section className="vyapaar-module-grid">
      <form className="admin-panel admin-product-form" onSubmit={createAccount}>
        <div className="admin-panel-heading"><div><span>STARTING BALANCE</span><h2>Add an account</h2></div></div>
        <label>Account name<input value={newAccount.name} onChange={event => setNewAccount({ ...newAccount, name: event.target.value })} minLength={2} maxLength={80} required /></label>
        <div className="admin-form-row">
          <label>Type<select value={newAccount.type} onChange={event => setNewAccount({ ...newAccount, type: event.target.value })}><option value="cash">Cash</option><option value="bank">Bank</option></select></label>
          <label>Opening balance (₹)<input type="number" min="0" step="0.01" value={newAccount.openingBalance} onChange={event => setNewAccount({ ...newAccount, openingBalance: event.target.value })} required /></label>
        </div>
        <button className="admin-secondary-button" disabled={saving}>Create account</button>
      </form>
      <form className="admin-panel admin-product-form" onSubmit={submit}>
        <div className="admin-panel-heading"><div><span>MANUAL ENTRY</span><h2>Record movement</h2></div></div>
        <label>Movement<select value={form.direction} onChange={event => setForm({ ...form, direction: event.target.value })}><option value="in">Money in</option><option value="out">Money out</option><option value="transfer">Transfer between accounts</option></select></label>
        {form.direction === 'transfer' ? <div className="admin-form-row">
          <label>From<select value={form.fromAccountId} onChange={event => setForm({ ...form, fromAccountId: event.target.value })}><AccountOptions accounts={accounts} /></select></label>
          <label>To<select value={form.toAccountId} onChange={event => setForm({ ...form, toAccountId: event.target.value })}><AccountOptions accounts={accounts} /></select></label>
        </div> : <label>Account<select value={form.accountId} onChange={event => setForm({ ...form, accountId: event.target.value })}><AccountOptions accounts={accounts} /></select></label>}
        <div className="admin-form-row">
          <label>Amount (₹)<input type="number" min="0.01" step="0.01" value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value })} required /></label>
          <label>Reference (optional)<input value={form.reference} maxLength={120} onChange={event => setForm({ ...form, reference: event.target.value })} /></label>
        </div>
        <label>Description<input value={form.description} minLength={3} maxLength={200} onChange={event => setForm({ ...form, description: event.target.value })} required /></label>
        <button className="admin-primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save movement'}</button>
      </form>
    </section>
    <section className="admin-panel vyapaar-sales-panel"><div className="admin-panel-heading"><div><span>APPEND-ONLY TRANSACTION HISTORY</span><h2>Cashbook</h2></div></div>
      {entries.length ? <div className="vyapaar-sales-table-wrap"><table className="vyapaar-sales-table"><thead><tr><th>Date</th><th>Account</th><th>Type</th><th>Description</th><th>Reference</th><th>Amount</th></tr></thead><tbody>{entries.map((entry, index) => <tr key={`${entry.requestId}:${entry.leg}:${index}`}><td>{formatDate(entry.createdAt)}</td><td>{entry.accountName}</td><td>{entry.type}</td><td>{entry.description}</td><td>{entry.reference || '—'}</td><td>{formatMoney(entry.amountPaise / 100)}</td></tr>)}</tbody></table></div> : <p className="admin-empty">No cashbook movements recorded yet.</p>}
    </section>
    <p className="vyapaar-disclaimer">Balances are operational records. Existing payments are not retroactively included; add accurate opening balances. This is not a formal accounting ledger.</p>
  </div>;
}

export function ExpensesManager() {
  const { accounts, error: accountError } = useAccounts();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ category: 'Other', description: '', amount: '', accountId: 'cash-default', reference: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    try { setItems((await api('/api/admin/vyapaar/expenses')).items); }
    catch (loadError) { setError(loadError.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await api('/api/admin/vyapaar/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: Number(form.amount), requestId: requestId() }),
      });
      setForm(current => ({ ...current, description: '', amount: '', reference: '' }));
      setNotice('Expense recorded and posted to the selected cash/bank account.');
      await load();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSaving(false);
    }
  };

  return <div className="vyapaar-content">
    <section className="vyapaar-page-heading"><span className="vyapaar-eyebrow">OPERATING COSTS</span><h1>Expenses</h1><p>Record paid operational expenses. Each expense is posted as an outflow to the selected cash or bank account.</p></section>
    <Banner error={error || accountError} notice={notice} />
    <form className="admin-panel admin-product-form" onSubmit={submit}>
      <div className="admin-panel-heading"><div><span>PAID EXPENSE</span><h2>Record an expense</h2></div></div>
      <div className="admin-form-row">
        <label>Category<input list="vyapaar-expense-categories" value={form.category} maxLength={60} onChange={event => setForm({ ...form, category: event.target.value })} required /><datalist id="vyapaar-expense-categories">{['Rent', 'Utilities', 'Shipping', 'Packaging', 'Supplies', 'Travel', 'Marketing', 'Other'].map(value => <option key={value} value={value} />)}</datalist></label>
        <label>Amount (₹)<input type="number" min="0.01" step="0.01" value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value })} required /></label>
      </div>
      <label>Description<input value={form.description} minLength={3} maxLength={300} onChange={event => setForm({ ...form, description: event.target.value })} required /></label>
      <div className="admin-form-row">
        <label>Paid from<select value={form.accountId} onChange={event => setForm({ ...form, accountId: event.target.value })}><AccountOptions accounts={accounts} /></select></label>
        <label>Reference (optional)<input value={form.reference} maxLength={120} onChange={event => setForm({ ...form, reference: event.target.value })} /></label>
      </div>
      <button className="admin-primary-button" disabled={saving}>{saving ? 'Saving…' : 'Record paid expense'}</button>
    </form>
    <section className="admin-panel vyapaar-sales-panel"><div className="admin-panel-heading"><div><span>RECENT PAID COSTS</span><h2>Expense history</h2></div></div>
      {items.length ? <div className="vyapaar-sales-table-wrap"><table className="vyapaar-sales-table"><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Account</th><th>Amount</th></tr></thead><tbody>{items.map(item => <tr key={item.requestId}><td>{formatDate(item.createdAt)}</td><td>{item.category}</td><td>{item.description}</td><td>{accounts.find(account => account.id === item.accountId)?.name || 'Unknown account'}</td><td>{formatMoney(item.amount)}</td></tr>)}</tbody></table></div> : <p className="admin-empty">No expenses recorded yet.</p>}
    </section>
    <p className="vyapaar-disclaimer">Expenses are simple operational records. Tax treatment, reimbursement workflows, and statutory expense accounting are not included.</p>
  </div>;
}

export function ReturnsManager() {
  const [kind, setKind] = useState('sale');
  const [sourceNumber, setSourceNumber] = useState('');
  const [source, setSource] = useState(null);
  const [returns, setReturns] = useState({ sales: [], purchases: [] });
  const [priorQuantities, setPriorQuantities] = useState({});
  const [lines, setLines] = useState({});
  const [refundAmount, setRefundAmount] = useState('0');
  const [refundAccountId, setRefundAccountId] = useState('cash-default');
  const { accounts } = useAccounts();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadReturns = useCallback(async () => {
    try { setReturns(await api('/api/admin/vyapaar/returns')); }
    catch (loadError) { setError(loadError.message); }
  }, []);
  useEffect(() => { loadReturns(); }, [loadReturns]);

  const findSource = async event => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSource(null);
    setLines({});
    setPriorQuantities({});
    try {
      let found;
      if (kind === 'sale') {
        const result = await api(`/api/admin/sales/${encodeURIComponent(sourceNumber.trim())}`);
        found = result.sale;
      } else {
        const result = await api(`/api/admin/purchases?page=1&q=${encodeURIComponent(sourceNumber.trim())}`);
        const purchase = result.items.find(item => item.purchaseNumber === sourceNumber.trim());
        if (!purchase) throw new Error('Purchase not found. Check the purchase number.');
        found = purchase;
      }
      const number = kind === 'sale' ? found.invoiceNumber : found.purchaseNumber;
      const summary = await api(`/api/admin/vyapaar/returns?kind=${kind}&sourceNumber=${encodeURIComponent(number)}`);
      setPriorQuantities(summary.quantities);
      setSource(found);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  const priorQuantity = slug => priorQuantities[slug] || 0;

  const submit = async event => {
    event.preventDefault();
    if (!source) return;
    const selected = Object.entries(lines).filter(([, quantity]) => Number(quantity) > 0)
      .map(([slug, quantity]) => ({ slug, quantity: Number(quantity) }));
    if (!selected.length) { setError('Enter a return quantity for at least one item.'); return; }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const endpoint = kind === 'sale' ? 'sales' : 'purchases';
      await api(`/api/admin/vyapaar/returns/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: requestId(),
          [kind === 'sale' ? 'invoiceNumber' : 'purchaseNumber']: kind === 'sale' ? source.invoiceNumber : source.purchaseNumber,
          lines: selected,
          refundAmount: kind === 'sale' ? Number(refundAmount) : undefined,
          accountId: refundAccountId,
          reference: 'Items received/dispatched and checked by administrator',
        }),
      });
      setNotice(kind === 'sale' ? 'Sales return recorded; stock restored and any refund posted.' : 'Purchase return recorded; stock reduced and supplier credit noted.');
      setSource(null);
      setLines({});
      setPriorQuantities({});
      await loadReturns();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSaving(false);
    }
  };

  const number = kind === 'sale' ? source?.invoiceNumber : source?.purchaseNumber;
  const sourceLines = source?.lines || [];
  const paidBlocked = kind === 'sale' && source && source.balanceDue > 0;
  return <div className="vyapaar-content">
    <section className="vyapaar-page-heading"><span className="vyapaar-eyebrow">LINKED CREDIT NOTES</span><h1>Sales &amp; purchase returns</h1><p>Record physical receipt/dispatch of returned items. Original invoices remain unchanged; returns are appended as separate operational credit records.</p></section>
    <Banner error={error} notice={notice} />
    <section className="admin-panel">
      <div className="admin-panel-heading"><div><span>PHYSICAL INVENTORY CHECK</span><h2>Start a return</h2></div></div>
      <form className="admin-order-filters vyapaar-return-lookup" onSubmit={findSource}>
        <label>Return type<select value={kind} onChange={event => { setKind(event.target.value); setSource(null); setLines({}); setPriorQuantities({}); }}><option value="sale">Customer / sales return</option><option value="purchase">Supplier / purchase return</option></select></label>
        <label>{kind === 'sale' ? 'Invoice number' : 'Purchase number'}<input value={sourceNumber} onChange={event => setSourceNumber(event.target.value)} maxLength={100} required /></label>
        <button className="admin-secondary-button" disabled={loading}>{loading ? 'Looking up…' : 'Find transaction'}</button>
      </form>
      {source && <form className="admin-product-form vyapaar-return-lines" onSubmit={submit}>
        <div className="vyapaar-settings-note"><b>{number} · {kind === 'sale' ? source.customer?.name : source.supplierName}</b><span>Total {formatMoney(source.total)} · Paid {formatMoney(source.amountPaid)} · Due {formatMoney(source.balanceDue)}</span></div>
        {paidBlocked && <p className="admin-error">Settle the sales invoice balance before processing a return or refund.</p>}
        <div className="vyapaar-sales-table-wrap"><table className="vyapaar-sales-table"><thead><tr><th>Item</th><th>Sold/received</th><th>Previously returned</th><th>Remaining</th><th>Return now</th></tr></thead><tbody>
          {sourceLines.map(line => {
            const prior = priorQuantity(line.slug);
            const remaining = Math.max(0, line.quantity - prior);
            return <tr key={line.slug}><td>{line.name}</td><td>{line.quantity} {line.unit}</td><td>{prior}</td><td>{remaining}</td><td><input aria-label={`Return quantity for ${line.name}`} type="number" min="0" max={remaining} step="1" value={lines[line.slug] || ''} onChange={event => setLines(current => ({ ...current, [line.slug]: event.target.value }))} /></td></tr>;
          })}
        </tbody></table></div>
        {kind === 'sale' && <div className="admin-form-row">
          <label>Refund amount (₹)<input type="number" min="0" max={source.amountPaid} step="0.01" value={refundAmount} onChange={event => setRefundAmount(event.target.value)} /></label>
          <label>Refund from<select value={refundAccountId} onChange={event => setRefundAccountId(event.target.value)}><AccountOptions accounts={accounts} /></select></label>
        </div>}
        <button className="admin-primary-button" disabled={saving || paidBlocked}>{saving ? 'Recording…' : 'Confirm checked items and record return'}</button>
      </form>}
    </section>
    <div className="vyapaar-module-grid">
      <ReturnHistory title="Recent sales returns" items={returns.sales} numberField="invoiceNumber" />
      <ReturnHistory title="Recent purchase returns" items={returns.purchases} numberField="purchaseNumber" />
    </div>
    <p className="vyapaar-disclaimer">Sales refunds are capped by the amount collected and require a settled invoice. Supplier returns create a supplier credit note; any supplier cash refund must be recorded as money-in separately. Verify physical goods before confirming. Operational records only, not statutory credit notes.</p>
  </div>;
}

function ReturnHistory({ title, items, numberField }) {
  return <section className="admin-panel"><div className="admin-panel-heading"><div><span>APPEND-ONLY RECORDS</span><h2>{title}</h2></div></div>
    {items.length ? <div className="vyapaar-return-history">{items.slice(0, 12).map(item => <article key={item.requestId}><div><b>{item[numberField]}</b><span>{item.partyName} · {formatDate(item.createdAt)}</span><small>{item.lines.map(line => `${line.name} × ${line.quantity}`).join(', ')}</small></div><strong>{formatMoney(item.credit)} credit{item.refund > 0 ? ` · ${formatMoney(item.refund)} refunded` : ''}</strong></article>)}</div> : <p className="admin-empty">No returns recorded.</p>}
  </section>;
}

export function ReportsManager() {
  const [range, setRange] = useState({ from: '', to: '' });
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const params = useMemo(() => new URLSearchParams(Object.entries(range).filter(([, value]) => value)), [range]);
  const load = async event => {
    event?.preventDefault();
    setLoading(true);
    setError('');
    try {
      const query = params.toString();
      setReport(await api(`/api/admin/vyapaar/reports${query ? `?${query}` : ''}`));
    }
    catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const download = () => {
    if (!report) return;
    const rows = [
      ['Metric', 'Count', 'Amount INR'],
      ['Sales', report.sales.count, report.sales.amount],
      ['Sales returns', report.salesReturns.count, report.salesReturns.amount],
      ['Purchases', report.purchases.count, report.purchases.amount],
      ['Purchase returns', report.purchaseReturns.count, report.purchaseReturns.amount],
      ['Expenses', report.expenses.count, report.expenses.amount],
      ['Cashbook inflow', '', report.cashbook.inflow],
      ['Cashbook outflow', '', report.cashbook.outflow],
      ['Cashbook net', '', report.cashbook.net],
      ['Inventory items', report.inventory.items, ''],
      ['Inventory units', report.inventory.units, ''],
    ];
    const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'vyapaar-operational-report.csv';
    link.click();
    URL.revokeObjectURL(url);
  };
  return <div className="vyapaar-content">
    <section className="vyapaar-page-heading"><span className="vyapaar-eyebrow">OPERATIONAL SUMMARY</span><h1>Reports</h1><p>Review sales, returns, purchases, expenses, cashbook movement, and current inventory.</p></section>
    <form className="admin-panel admin-order-filters" onSubmit={load}>
      <label>From<input type="date" value={range.from} onChange={event => setRange({ ...range, from: event.target.value })} /></label>
      <label>To<input type="date" value={range.to} onChange={event => setRange({ ...range, to: event.target.value })} /></label>
      <button className="admin-primary-button" disabled={loading}>{loading ? 'Loading…' : 'Run report'}</button>
      <button className="admin-secondary-button" type="button" onClick={download} disabled={!report}>Download CSV</button>
    </form>
    {error && <p className="admin-error" role="alert">{error}</p>}
    {report && <>
      <section className="vyapaar-metrics vyapaar-report-cards">
        <ReportCard label="Sales" data={report.sales} />
        <ReportCard label="Sales returns" data={report.salesReturns} />
        <ReportCard label="Purchases" data={report.purchases} />
        <ReportCard label="Purchase returns" data={report.purchaseReturns} />
        <ReportCard label="Expenses" data={report.expenses} />
        <article><span>Cashbook net</span><b>{formatMoney(report.cashbook.net)}</b><small>In {formatMoney(report.cashbook.inflow)} · Out {formatMoney(report.cashbook.outflow)}</small></article>
        <article><span>Current inventory</span><b>{report.inventory.units} units</b><small>{report.inventory.items} active items</small></article>
      </section>
      <div className="vyapaar-settings-note"><b>Cash / bank accounts</b>{report.accounts.map(account => <span key={account.id}>{account.name} ({account.type}) · {formatMoney(account.balancePaise / 100)} current balance</span>)}</div>
      <p className="vyapaar-disclaimer">{report.disclaimer}</p>
    </>}
  </div>;
}

function ReportCard({ label, data }) {
  return <article><span>{label}</span><b>{formatMoney(data.amount)}</b><small>{data.count} records</small></article>;
}

const CODE39 = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw', '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn', '9': 'nnwwnnwnn', A: 'wnnnnwnnw', B: 'nnwnnwnnw',
  C: 'wnwnnwnnn', D: 'nnnnwwnnw', E: 'wnnnwwnnn', F: 'nnwnwwnnn',
  G: 'nnnnnwwnw', H: 'wnnnnwwnn', I: 'nnwnnwwnn', J: 'nnnnwwwnn',
  K: 'wnnnnnnww', L: 'nnwnnnnww', M: 'wnwnnnnwn', N: 'nnnnwnnww',
  O: 'wnnnwnnwn', P: 'nnwnwnnwn', Q: 'nnnnnnwww', R: 'wnnnnnwwn',
  S: 'nnwnnnwwn', T: 'nnnnwnwwn', U: 'wwnnnnnnw', V: 'nwwnnnnnw',
  W: 'wwwnnnnnn', X: 'nwnnwnnnw', Y: 'wwnnwnnnn', Z: 'nwwnwnnnn',
  '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '$': 'nwnwnwnnn',
  '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn', '*': 'nwnnwnwnn',
};

function Code39({ value }) {
  const encoded = `*${value.toUpperCase()}*`;
  if ([...encoded].some(character => !CODE39[character])) return <span className="vyapaar-barcode-text">{value}</span>;
  const bars = [];
  let x = 10;
  for (const [index, character] of [...encoded].entries()) {
    [...CODE39[character]].forEach((width, position) => {
      const unit = width === 'w' ? 3 : 1;
      if (position % 2 === 0) bars.push(<rect key={`${index}-${position}`} x={x} y="0" width={unit} height="42" />);
      x += unit;
    });
    x += 1;
  }
  return <svg className="vyapaar-barcode-svg" viewBox={`0 0 ${x + 9} 42`} role="img" aria-label={`Code 39 barcode ${value}`}>{bars}</svg>;
}

export function BarcodeLabelsManager() {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const search = async event => {
    event?.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await api(`/api/admin/products?page=1&q=${encodeURIComponent(query.trim())}`);
      setItems(result.items.filter(item => !item.archived));
      setSelected({});
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { search(); }, []);
  const selectedItems = items.filter(item => selected[item.slug]);
  return <div className="vyapaar-content vyapaar-barcode-page">
    <section className="vyapaar-page-heading vyapaar-no-print"><span className="vyapaar-eyebrow">PRINTABLE LABELS</span><h1>Barcode labels</h1><p>Search items, select labels and print from your browser. Uses Code 39; labels encode the saved barcode or, if absent, the SKU.</p></section>
    <form className="admin-stock-search vyapaar-no-print" onSubmit={search}><label>Find items<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Name, SKU, or barcode" /></label><button className="admin-secondary-button" disabled={loading}>{loading ? 'Searching…' : 'Search'}</button><button className="admin-primary-button" type="button" onClick={() => window.print()} disabled={!selectedItems.length}>Print {selectedItems.length || ''} labels</button></form>
    {error && <p className="admin-error vyapaar-no-print" role="alert">{error}</p>}
    <section className="admin-panel vyapaar-no-print"><div className="admin-panel-heading"><div><span>SELECT LABELS</span><h2>Catalogue items</h2></div></div>
      {items.length ? <div className="vyapaar-label-picker">{items.map(item => <label key={item.slug}><input type="checkbox" checked={Boolean(selected[item.slug])} onChange={event => setSelected(current => ({ ...current, [item.slug]: event.target.checked }))} /><span><b>{item.name}</b><small>{item.barcode || item.sku || 'No barcode or SKU'}</small></span></label>)}</div> : <p className="admin-empty">No items found.</p>}
    </section>
    {!!selectedItems.length && <section className="vyapaar-print-labels" aria-label="Printable labels">{selectedItems.map(item => {
      const value = String(item.barcode || item.sku || '');
      return <article className="vyapaar-print-label" key={item.slug}><b>{item.name}</b>{value ? <><Code39 value={value} /><small>{value.toUpperCase()}</small></> : <small>Add a barcode or SKU before printing.</small>}</article>;
    })}</section>}
    <p className="vyapaar-disclaimer vyapaar-no-print">Labels are printable Code 39 operational labels, not GTIN/EAN registration. Use uppercase letters, numbers, spaces, and Code 39 symbols for scanner-compatible values.</p>
  </div>;
}

export function ActivityLogManager() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api(`/api/admin/vyapaar/activity?page=${page}`);
      setItems(result.items);
      setTotal(result.total);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [page]);
  useEffect(() => { load(); }, [load]);
  return <div className="vyapaar-content">
    <section className="vyapaar-page-heading"><span className="vyapaar-eyebrow">ADMIN MUTATIONS</span><h1>Activity log</h1><p>Successful create, update and delete requests made through admin APIs are logged with the actor and route. Request bodies and sensitive data are not stored.</p></section>
    {error && <p className="admin-error" role="alert">{error}</p>}
    <section className="admin-panel"><div className="admin-panel-heading"><div><span>{total} events · page {page}</span><h2>Recent admin actions</h2></div><div className="admin-pagination"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage(current => current - 1)}>Previous</button><button type="button" disabled={page * 50 >= total || loading} onClick={() => setPage(current => current + 1)}>Next</button></div></div>
      {loading ? <p className="admin-loading">Loading activity…</p> : items.length ? <div className="vyapaar-sales-table-wrap"><table className="vyapaar-sales-table"><thead><tr><th>Date</th><th>Actor</th><th>Action</th><th>Resource</th><th>HTTP</th></tr></thead><tbody>{items.map((item, index) => <tr key={`${item.createdAt}:${index}`}><td>{formatDate(item.createdAt)}</td><td>{item.actorEmail}</td><td>{item.action}</td><td>{item.resource}</td><td>{item.statusCode}</td></tr>)}</tbody></table></div> : <p className="admin-empty">No activity recorded yet. New successful admin mutations will appear here.</p>}
    </section>
    <p className="vyapaar-disclaimer">The log starts when this module deploys. It does not backfill historical actions or record read-only activity.</p>
  </div>;
}
