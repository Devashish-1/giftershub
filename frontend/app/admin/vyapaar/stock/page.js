import StockManager from '../../../../components/StockManager';

export default function VyapaarStockPage() {
  return (
    <div className="vyapaar-content">
      <section className="vyapaar-page-heading">
        <span className="vyapaar-eyebrow">INVENTORY LEDGER</span>
        <h1>Stock adjustments</h1>
        <p>Every correction records its reason, operator, and previous and updated stock balance.</p>
      </section>
      <StockManager />
    </div>
  );
}
