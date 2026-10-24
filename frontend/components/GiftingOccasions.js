import Image from 'next/image';
import Link from 'next/link';
import { GIFT_OCCASIONS } from '../lib/gifting';

export default function GiftingOccasions({ products }) {
  return (
    <section className="gifting-occasions" aria-labelledby="gifting-occasions-heading">
      <div className="section-heading">
        <div>
          <span className="eyebrow">A thoughtful gift for every moment</span>
          <h2 id="gifting-occasions-heading">Shop by occasion</h2>
        </div>
        <span className="gifting-note">Curated from the current catalogue</span>
      </div>
      <div className="gifting-occasion-grid">
        {GIFT_OCCASIONS.map(occasion => {
          const image = products.find(product =>
            product.category === occasion.category && product.subject === occasion.subject)?.image || occasion.image;

          return (
            <article className="gifting-occasion-card" key={occasion.slug}>
              <Link className="gifting-occasion-image" href={`/shop?occasion=${occasion.slug}`}>
                <Image src={image} alt="" fill sizes="(max-width: 700px) 80vw, 25vw" />
                <span>{occasion.title}</span>
              </Link>
              <div className="gifting-occasion-content">
                <h3>{occasion.heading}</h3>
                <p>{occasion.description}</p>
                <Link className="gifting-occasion-link" href={`/shop?occasion=${occasion.slug}`}>
                  Browse {occasion.title.toLowerCase()} ideas <span aria-hidden="true">→</span>
                </Link>
              </div>
            </article>
          );
        })}
      </div>
      <p className="gifting-catalogue-note">Gift ideas are selected from available catalogue designs. Retail prices and ordering are coming soon.</p>
    </section>
  );
}
