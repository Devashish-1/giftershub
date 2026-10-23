import AdminProductManager from '../../../../components/AdminProductManager';

export default function VyapaarItemsPage() {
  return (
    <div className="vyapaar-content">
      <section className="vyapaar-page-heading">
        <span className="vyapaar-eyebrow">CATALOGUE</span>
        <h1>Items &amp; inventory</h1>
        <p>Manage product details, availability, costs and prices. Use category settings for your own item groups, and record stock changes in the audit ledger.</p>
      </section>
      <AdminProductManager />
    </div>
  );
}
