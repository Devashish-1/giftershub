import Link from 'next/link';

export const metadata = {
  title: 'Terms & Conditions | The Gifter’s Hub',
  description: 'Terms for using The Gifter’s Hub website and placing an order.',
};

export default function TermsPage() {
  return (
    <article className="wrap legal-page">
      <div className="eyebrow">The Gifter’s Hub</div>
      <h1>Terms &amp; Conditions</h1>
      <p className="legal-updated">Last updated: 19 October 2026</p>
      <p className="legal-intro">These terms explain the basic rules for browsing and ordering from The Gifter’s Hub. By using this website or placing an order, you agree to these terms.</p>

      <section>
        <h2>1. About our store</h2>
        <p>The Gifter’s Hub offers gifts, decor, idols and related products through this website. The website and its content are operated by The Gifter’s Hub in New Delhi, India.</p>
      </section>
      <section>
        <h2>2. Products and availability</h2>
        <p>We aim to keep product descriptions, images, prices and availability accurate. Colours and appearance may vary slightly between screens and actual products. Product images are illustrative where identified as such. We may correct listing errors or update availability; if an order cannot be fulfilled, we will contact you using the details provided.</p>
      </section>
      <section>
        <h2>3. Orders and prices</h2>
        <p>Submitting an order is a request to purchase the selected products. We will confirm the order through the website or using your contact details. Prices are shown in Indian rupees. Any applicable delivery charges or offers are shown during checkout and may depend on the order and delivery location.</p>
      </section>
      <section>
        <h2>4. Payment and delivery</h2>
        <p>Cash on Delivery is currently the available checkout method. Online payments are not enabled yet; any online-payment button marked “Coming soon” cannot be used to pay. Delivery estimates are indicative and may change due to location, carrier availability or circumstances outside our control.</p>
      </section>
      <section>
        <h2>5. Cancellations, returns and consumer rights</h2>
        <p>If an item arrives damaged, incorrect or defective, please contact us promptly at <a href="tel:+919555532044">+91 95555 32044</a> with your order details so we can review the issue. Eligibility for cancellation, return, replacement or refund depends on the circumstances and applicable Indian consumer-protection law. Nothing in these terms takes away rights that cannot legally be excluded.</p>
      </section>
      <section>
        <h2>6. Website use</h2>
        <p>Please provide accurate delivery and contact information, keep your account credentials private and use the website lawfully. Do not attempt to disrupt, gain unauthorised access to, or misuse the website or its services.</p>
      </section>
      <section>
        <h2>7. Privacy and changes</h2>
        <p>Our <Link href="/privacy">Privacy Policy</Link> describes how account, order and delivery information is handled. We may update these terms when our services or legal obligations change. The current version and its update date will be published on this page.</p>
      </section>
      <section>
        <h2>8. Contact</h2>
        <p>Questions about an order or these terms? Call <a href="tel:+919555532044">+91 95555 32044</a> or visit The Gifter’s Hub at B - 21, Street No. 3, Dichaon Enclave, Kalan, Dichaon Kalan, Delhi, 110043, Jai Vihar, New Delhi.</p>
      </section>
    </article>
  );
}
