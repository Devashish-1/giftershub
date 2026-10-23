'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

const FIELD_NAMES = [
  ['name', 'Item name', true],
  ['slug', 'URL slug', true],
  ['category', 'Category', true],
  ['image', 'Image path', true],
  ['sku', 'SKU', false],
  ['barcode', 'Barcode', false],
  ['subject', 'Artwork / deity', false],
  ['unit', 'Unit', false],
  ['purchasePrice', 'Purchase price', false],
  ['price', 'Selling price', false],
  ['mrp', 'MRP', false],
  ['taxRate', 'Tax rate', false],
  ['lowStockThreshold', 'Low-stock threshold', false],
  ['status', 'Status', false],
  ['desc', 'Description', false],
];

const TEMPLATE_HEADERS = FIELD_NAMES.map(([field]) => field);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"' && !cell) {
      quoted = true;
    } else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && source[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error('The CSV contains an unclosed quoted field.');
  if (cell || row.length) {
    row.push(cell);
    if (row.some(value => value.trim())) rows.push(row);
  }
  return rows;
}

function downloadTemplate() {
  const content = `${TEMPLATE_HEADERS.join(',')}\r\n`;
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'vyapaar-items-template.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function ProductCsvImporter() {
  const [headers, setHeaders] = useState([]);
  const [records, setRecords] = useState([]);
  const [mapping, setMapping] = useState({});
  const [filename, setFilename] = useState('');
  const [loadingFile, setLoadingFile] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [method, setMethod] = useState('csv');
  const [barcodeQuery, setBarcodeQuery] = useState('');
  const [barcodeResults, setBarcodeResults] = useState([]);
  const [searchingBarcode, setSearchingBarcode] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/categories', { credentials: 'same-origin' })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Could not load item categories.');
        if (!cancelled) {
          setCategories(payload.items);
          setCategoriesLoaded(true);
        }
      })
      .catch(requestError => {
        if (!cancelled) setError(requestError.message || 'Could not load item categories.');
      });
    return () => { cancelled = true; };
  }, []);

  const mappedRows = useMemo(() => records.map(record => Object.fromEntries(
    FIELD_NAMES.map(([field]) => {
      const index = mapping[field];
      return [field, index === '' || index === undefined ? '' : record[index] || ''];
    }),
  )), [records, mapping]);

  const rowErrors = useMemo(() => mappedRows.map((row, index) => {
    const issues = [];
    if (!row.name.trim()) issues.push('Missing name');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug.trim().toLowerCase())) issues.push('Invalid slug');
    if (categoriesLoaded && !categories.some(category => category.slug === row.category.trim() && !category.archived)) issues.push('Unknown category');
    if (!/^\/products\/[A-Za-z0-9][A-Za-z0-9._-]*\.(webp|png|jpe?g)$/i.test(row.image.trim())) issues.push('Invalid image path');
    for (const field of ['price', 'purchasePrice', 'mrp', 'taxRate', 'lowStockThreshold']) {
      if (row[field].trim() && !Number.isFinite(Number(row[field]))) issues.push(`Invalid ${field}`);
    }
    if (row.taxRate.trim() && ![0, 5, 12, 18, 28].includes(Number(row.taxRate))) issues.push('Unsupported tax rate');
    if (row.status.trim() && !['active', 'coming-soon', 'out-of-stock'].includes(row.status.trim())) issues.push('Invalid status');
    for (const field of ['slug', 'sku', 'barcode']) {
      const value = row[field].trim().toLowerCase();
      if (value && mappedRows.slice(0, index).some(previous => previous[field].trim().toLowerCase() === value)) {
        issues.push(`Duplicate ${field.toUpperCase()} in file`);
      }
    }
    return issues;
  }), [mappedRows, categories, categoriesLoaded]);

  const loadFile = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setResult(null);
    setHeaders([]);
    setRecords([]);
    setLoadingFile(true);
    try {
      if (!file.name.toLowerCase().endsWith('.csv') || file.size > 1024 * 1024) {
        throw new Error('Choose a CSV file no larger than 1 MB.');
      }
      const rows = parseCsv(await file.text());
      if (rows.length < 2) throw new Error('The CSV needs a header and at least one item row.');
      if (rows.length > 501) throw new Error('Import 500 item rows or fewer at a time.');
      const fileHeaders = rows[0].map(header => header.trim());
      if (new Set(fileHeaders.map(header => header.toLowerCase())).size !== fileHeaders.length) {
        throw new Error('Each CSV column must have a unique header.');
      }
      setHeaders(fileHeaders);
      setRecords(rows.slice(1).map(row => fileHeaders.map((_, index) => row[index] || '')));
      setMapping(Object.fromEntries(FIELD_NAMES.map(([field]) => {
        const column = fileHeaders.findIndex(header => header.toLowerCase().replace(/[\s_-]+/g, '') === field.toLowerCase());
        return [field, column < 0 ? '' : String(column)];
      })));
      setFilename(file.name);
    } catch (fileError) {
      setError(fileError.message || 'Could not read this CSV file.');
    } finally {
      setLoadingFile(false);
    }
  };

  const submitImport = async () => {
    setImporting(true);
    setError('');
    setResult(null);
    try {
      const rows = mappedRows.map(row => ({
        ...row,
        slug: row.slug.trim().toLowerCase(),
        unit: row.unit.trim() || 'piece',
        status: row.status.trim() || 'coming-soon',
        taxRate: row.taxRate.trim() || '0',
        lowStockThreshold: row.lowStockThreshold.trim() || '0',
      }));
      const response = await fetch('/api/admin/products/import', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const payload = await response.json();
      if (!response.ok && response.status !== 207) throw new Error(payload.error || 'Could not import these items.');
      setResult(payload);
    } catch (requestError) {
      setError(requestError.message || 'Could not import these items.');
    } finally {
      setImporting(false);
    }
  };

  const lookupBarcode = async event => {
    event.preventDefault();
    setSearchingBarcode(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/products/barcode/${encodeURIComponent(barcodeQuery.trim())}`, { credentials: 'same-origin' });
      const payload = await response.json();
      if (!response.ok && response.status !== 404) throw new Error(payload.error || 'Could not search saved item barcodes.');
      setBarcodeResults(response.ok ? [payload.item] : []);
    } catch (requestError) {
      setError(requestError.message || 'Could not search saved item barcodes.');
    } finally {
      setSearchingBarcode(false);
    }
  };

  const requiredFieldsMapped = FIELD_NAMES.filter(([, , required]) => required)
    .every(([field]) => mapping[field] !== '' && mapping[field] !== undefined);
  const validRows = rowErrors.filter(issues => !issues.length).length;

  return (
    <div className="vyapaar-content">
      <section className="vyapaar-page-heading">
        <span className="vyapaar-eyebrow">INVENTORY · DATA IMPORT</span>
        <h1>Import items</h1>
        <p>Map a CSV file, review rows, and create new items without overwriting existing records. Opening stock must be entered separately through Stock Adjustments so it is recorded in the ledger.</p>
      </section>
      <section className="admin-panel vyapaar-import-panel">
        <div className="admin-panel-heading"><div><span>Step 1</span><h2>Choose an import method</h2></div></div>
        <div className="vyapaar-import-methods">
          <button type="button" className={method === 'barcode' ? 'selected' : ''} onClick={() => setMethod('barcode')}><b>Barcode lookup</b><span>Search for a barcode already saved in your catalogue. No external barcode library is connected.</span></button>
          <button type="button" className={method === 'csv' ? 'selected' : ''} onClick={() => setMethod('csv')}><b>Import from Excel / CSV</b><span>Upload CSV, map fields, preview validation, and import new items.</span></button>
        </div>
        {method === 'barcode'
          ? <>
            <form className="admin-stock-search" onSubmit={lookupBarcode}>
              <label>Scan or enter an existing barcode<input value={barcodeQuery} onChange={event => setBarcodeQuery(event.target.value)} required /></label>
              <button className="admin-secondary-button" type="submit" disabled={searchingBarcode}>{searchingBarcode ? 'Searching…' : 'Look up'}</button>
            </form>
            {barcodeResults.map(item => <article className="vyapaar-barcode-result" key={item.slug}>
              <div><b>{item.name}</b><span>{item.barcode} · SKU {item.sku || '—'} · Stock {item.stock ?? 0}</span></div>
              <Link className="admin-secondary-button" href="/admin/vyapaar/items">Open item catalogue</Link>
            </article>)}
            {barcodeQuery && !searchingBarcode && barcodeResults.length === 0 && <p className="admin-empty">No exact barcode match in the saved catalogue. New barcode product data requires a configured provider.</p>}
          </>
          : <>
            <div className="admin-panel-heading"><div><span>Step 2</span><h2>Choose a CSV file</h2></div><button className="admin-secondary-button" type="button" onClick={downloadTemplate}>Download template</button></div>
            <label className="vyapaar-file-picker">CSV file (maximum 1 MB)<input type="file" accept=".csv,text/csv" onChange={loadFile} /></label>
            {filename && <p className="admin-loading">Selected: {filename}</p>}
            {loadingFile && <p className="admin-loading">Reading CSV…</p>}
          </>}
      </section>
      {method === 'csv' && headers.length > 0 && <>
        <section className="admin-panel vyapaar-import-panel">
          <div className="admin-panel-heading"><div><span>Step 2</span><h2>Map CSV columns</h2></div><span>{records.length} item rows</span></div>
          <div className="vyapaar-import-mapping">{FIELD_NAMES.map(([field, label, required]) => (
            <label key={field}>{label}{required && <b> Required</b>}<select value={mapping[field] ?? ''} onChange={event => setMapping(current => ({ ...current, [field]: event.target.value }))}>
              <option value="">Not mapped</option>
              {headers.map((header, index) => <option key={`${header}-${index}`} value={index}>{header}</option>)}
            </select></label>
          ))}</div>
        </section>
        <section className="admin-panel vyapaar-import-panel">
          <div className="admin-panel-heading"><div><span>Step 3</span><h2>Review import preview</h2></div><span>{validRows} valid · {records.length - validRows} with issues</span></div>
          {!requiredFieldsMapped && <p className="admin-error" role="alert">Map item name, URL slug, category, and image before importing.</p>}
          <div className="vyapaar-import-preview"><table className="vyapaar-sales-table">
            <thead><tr><th>Row</th><th>Name</th><th>Slug</th><th>Category</th><th>Price</th><th>Preview checks</th></tr></thead>
            <tbody>{mappedRows.slice(0, 100).map((row, index) => <tr key={`${row.slug}-${index}`}>
              <td>{index + 2}</td><td>{row.name || '—'}</td><td>{row.slug || '—'}</td><td>{row.category || '—'}</td><td>{row.price || '—'}</td>
              <td className={rowErrors[index].length ? 'invalid' : 'valid'}>{rowErrors[index].join(', ') || 'Ready'}</td>
            </tr>)}</tbody>
          </table></div>
          {records.length > 100 && <p className="admin-loading">Preview shows the first 100 rows; server validation covers the full file.</p>}
          {error && <p className="admin-error" role="alert">{error}</p>}
          {result && <div className="admin-notice" role="status"><b>{result.imported} items imported; {result.failed} rows failed.</b>
            {result.results.filter(row => row.status === 'failed').map(row => <p key={row.row}>Row {row.row}: {row.error}</p>)}
          </div>}
          <div className="admin-editor-actions">
            <Link href="/admin/vyapaar/items" className="admin-secondary-button">Cancel</Link>
            <button className="admin-primary-button" type="button" onClick={submitImport} disabled={importing || !categoriesLoaded || !requiredFieldsMapped || validRows !== records.length || !!result}>
              {importing ? 'Importing…' : `Import ${records.length} items`}
            </button>
          </div>
          {!categoriesLoaded && <p className="admin-error" role="alert">Item categories could not be verified. Reload the page before importing.</p>}
        </section>
      </>}
      {error && !headers.length && <p className="admin-error" role="alert">{error}</p>}
      <p className="vyapaar-disclaimer">Only new items are imported; conflicts are reported per row and existing products are never overwritten. Spreadsheet formulas are neutralized on export. Barcode product-library lookup is not configured; barcode search works against saved catalogue items.</p>
    </div>
  );
}
