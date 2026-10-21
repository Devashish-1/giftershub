import Image from 'next/image';
import Link from 'next/link';

function CrystalBubbleRow({ products, direction }) {
  return (
    <div className="crystal-bubble-window">
      <div className="crystal-bubble-track" data-direction={direction}>
        {[false, true].map((repeated, groupIndex) => (
          <div className="crystal-bubble-group" key={groupIndex} aria-hidden={repeated || undefined}>
            {products.map(product => (
              <Link
                className="crystal-bubble-slide"
                href={`/product/${product.slug}`}
                key={`${groupIndex}-${product.slug}`}
                aria-label={`View ${product.name}`}
                tabIndex={repeated ? -1 : undefined}
              >
                <span className="crystal-bubble-image">
                  <Image src={product.image} alt={product.name} fill sizes="(max-width: 520px) 70vw, 248px" />
                </span>
                <span>{product.name}</span>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CrystalBubbleShowcase({ products }) {
  if (!products.length) return null;

  const rows = [
    products.filter((_, index) => index % 2 === 0),
    products.filter((_, index) => index % 2 === 1),
  ];

  return (
    <section className="crystal-bubble-section" aria-labelledby="crystal-bubble-heading">
      <div className="section-heading">
        <div>
          <div className="eyebrow">New collection</div>
          <h2 id="crystal-bubble-heading">Crystal Bubble Frames</h2>
        </div>
        <Link href="/shop?category=crystal-bubble">Browse the collection <span aria-hidden="true">→</span></Link>
      </div>
      <div className="crystal-bubble-rows">
        <CrystalBubbleRow products={rows[0]} direction="forward" />
        {rows[1].length > 0 && <CrystalBubbleRow products={rows[1]} direction="reverse" />}
      </div>
    </section>
  );
}