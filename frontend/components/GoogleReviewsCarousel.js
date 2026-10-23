import Link from 'next/link';

const PLACE_ID = 'ChIJ-38sp8cPDTkRUeB-fkE1Z38';
const GOOGLE_MAPS_URL = `https://www.google.com/maps/search/?api=1&query=The+Gifter%27s+Hub&query_place_id=${PLACE_ID}`;
const GOOGLE_MAPS_EMBED_URL = 'https://www.google.com/maps?output=embed&q=The+Gifter%27s+Hub+Jai+Vihar+New+Delhi';

export default function GoogleReviewsCarousel() {
  return (
    <section className="google-reviews" aria-labelledby="google-reviews-heading">
      <div className="google-reviews-intro">
        <span className="eyebrow">CUSTOMER FEEDBACK · GOOGLE</span>
        <h2 id="google-reviews-heading">A little love from our customers.</h2>
        <p>See The Gifter’s Hub listing and current customer reviews directly on Google.</p>
        <Link href={GOOGLE_MAPS_URL} target="_blank" rel="noreferrer">
          Read Google reviews <span aria-hidden="true">↗</span>
        </Link>
      </div>
      <div className="google-reviews-embed">
        <iframe
          title="The Gifter’s Hub live Google Maps listing and customer reviews"
          src={GOOGLE_MAPS_EMBED_URL}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>
    </section>
  );
}
