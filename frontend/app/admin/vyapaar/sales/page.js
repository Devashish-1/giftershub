import { SalesManager } from '../../../../components/SalesManager';

export default function VyapaarSalesPage() {
  return (
    <div className="vyapaar-content">
      <section className="vyapaar-page-heading">
        <span className="vyapaar-eyebrow">TRANSACTIONS</span>
        <h1>Sales &amp; invoices</h1>
        <p>Create server-priced invoices from available inventory, record payments, and track outstanding balances.</p>
      </section>
      <SalesManager />
      <p className="vyapaar-disclaimer">Invoice totals and payment balances are operational records; tax configuration is not a statutory GST filing service.</p>
    </div>
  );
}
