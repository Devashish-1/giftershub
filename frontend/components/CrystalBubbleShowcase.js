import Image from 'next/image';
import Link from 'next/link';

const IMAGE_DIMENSIONS = {
  'crystal-bubble-01.webp': [1000, 1209],
  'crystal-bubble-02.webp': [1000, 1197],
  'crystal-bubble-03.webp': [1000, 1036],
  'crystal-bubble-04.webp': [817, 1280],
  'crystal-bubble-05.webp': [833, 1280],
  'crystal-bubble-06.webp': [814, 1280],
  'crystal-bubble-07.webp': [793, 1280],
  'crystal-bubble-08.webp': [810, 1280],
  'crystal-bubble-09.webp': [802, 1280],
  'crystal-bubble-10.webp': [824, 1280],
  'crystal-bubble-11.webp': [802, 1280],
  'crystal-bubble-12.webp': [792, 1280],
  'crystal-bubble-13.webp': [1000, 750],
  'crystal-bubble-14.webp': [1000, 750],
  'crystal-bubble-15.webp': [1000, 750],
  'crystal-bubble-16.webp': [1000, 750],
  'crystal-bubble-17.webp': [1000, 750],
  'crystal-bubble-18.webp': [1000, 750],
  'crystal-bubble-19.webp': [1000, 750],
};

function CrystalBubbleSlide({ product, repeated }) {
  const dimensions = IMAGE_DIMENSIONS[product.image?.split('/').pop()] || [1000, 750];
  const slideWidth = Math.min(292, Math.max(140, Math.round(220 * dimensions[0] / dimensions[1])));

  return (
    <Link
      className="crystal-bubble-slide"
      href={`/product/${product.slug}`}
      aria-label={`View ${product.name}`}
      tabIndex={repeated ? -1 : undefined}
      style={{ width: `${slideWidth}px` }}
    >
      <span className="crystal-bubble-image">
        <Image
          src={product.image}
          alt={product.name}
          width={dimensions[0]}
          height={dimensions[1]}
          sizes="(max-width: 520px) 220px, 292px"
        />
      </span>
      <span>{product.name}</span>
    </Link>
  );
}

function CrystalBubbleRow({ products, direction }) {
  return (
    <div className="crystal-bubble-window">
      <div className="crystal-bubble-track" data-direction={direction}>
        {[false, true].map((repeated, groupIndex) => (
          <div className="crystal-bubble-group" key={groupIndex} aria-hidden={repeated || undefined}>
            {products.map(product => (
              <CrystalBubbleSlide
                key={`${groupIndex}-${product.slug}`}
                product={product}
                repeated={repeated}
              />
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
        <Link href="/shop/crystal-bubble">Browse the collection <span aria-hidden="true">→</span></Link>
      </div>
      <div className="crystal-bubble-rows">
        <CrystalBubbleRow products={rows[0]} direction="forward" />
        {rows[1].length > 0 && <CrystalBubbleRow products={rows[1]} direction="reverse" />}
      </div>
    </section>
  );
}