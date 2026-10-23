import { SaleComposer } from '../../../../../components/SalesManager';

export default function NewVyapaarSalePage() {
  return (
    <div className="vyapaar-content">
      <section className="vyapaar-page-heading">
        <span className="vyapaar-eyebrow">TRANSACTIONS · NEW</span>
        <h1>Create a sale</h1>
        <p>Issue an invoice, apply available discounts, record an initial payment, and deduct stock atomically.</p>
      </section>
      <SaleComposer />
    </div>
  );
}
