import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | The Gifter’s Hub',
  description: 'How The Gifter’s Hub handles account, order and delivery information.',
};

export default function PrivacyPage() {
  return (
    <article className="wrap legal-page">
      <div className="eyebrow">The Gifter’s Hub</div>
      <h1>Privacy Policy</h1>
      <p className="legal-updated">Last updated: 19 October 2026</p>
      <p className="legal-intro">This policy describes the information The Gifter’s Hub uses to provide this website, manage accounts and fulfil orders.</p>

      <section>
        <h2>1. Information we collect</h2>
        <ul>
          <li><strong>Account information:</strong> email address and password credentials when you create an account. Passwords are stored as protected password hashes, not as plain text.</li>
          <li><strong>Order and delivery information:</strong> recipient name, mobile number, delivery address, pincode, products ordered, order total and any gift message you choose to provide.</li>
          <li><strong>Technical information:</strong> essential session-cookie information used to keep you signed in and protect account and checkout requests.</li>
        </ul>
        <p>Google and phone sign-in are not active at this time. Online payment details are not collected through this website because online payments are not enabled.</p>
      </section>
      <section>
        <h2>2. How we use information</h2>
        <p>We use information to create and secure accounts, process and deliver orders, respond to customer-service requests, prevent misuse, maintain the website and meet applicable legal obligations.</p>
      </section>
      <section>
        <h2>3. When information is shared</h2>
        <p>We share information only as needed to operate the service: with hosting, database and technical service providers that support the website; with delivery or fulfilment partners for orders; and where disclosure is required by law. We do not sell personal information. Online payment providers are not currently used for checkout.</p>
      </section>
      <section>
        <h2>4. Cookies and security</h2>
        <p>We use an essential HTTP-only session cookie to keep you signed in and recognise your authenticated requests. The cookie is not available to ordinary page scripts and expires after the session period. We use reasonable safeguards, but no internet service can guarantee absolute security.</p>
      </section>
      <section>
        <h2>5. Retention and your choices</h2>
        <p>We keep account and order information for as long as needed to operate the service, provide support, resolve disputes and meet legal or accounting requirements. You may contact us to request access, correction or deletion of account information. Some order records may need to be retained where the law requires it.</p>
      </section>
      <section>
        <h2>6. Children</h2>
        <p>This store is intended for general shoppers and is not designed to collect personal information from children without appropriate consent. Please contact us if you believe a child has provided personal information so we can review the request.</p>
      </section>
      <section>
        <h2>7. Policy updates</h2>
        <p>We may update this policy as our website, services or legal requirements change. The latest version and update date will appear on this page. Material changes will be communicated through the website where appropriate.</p>
      </section>
      <section>
        <h2>8. Contact</h2>
        <p>For privacy questions or requests, call <a href="tel:+919555532044">+91 95555 32044</a> or visit The Gifter’s Hub at B - 21, Street No. 3, Dichaon Enclave, Kalan, Dichaon Kalan, Delhi, 110043, Jai Vihar, New Delhi. For information on ordering, see our <Link href="/terms">Terms &amp; Conditions</Link>.</p>
      </section>
    </article>
  );
}
