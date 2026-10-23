import { absoluteUrl } from '../lib/seo';

export default function ProductShareLinks({ product }) {
  const productUrl = absoluteUrl(`/product/${encodeURIComponent(product.slug)}`);
  const shareText = `${product.name} from The Gifter’s Hub`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${productUrl}`)}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(productUrl)}`;

  return (
    <nav className="product-share" aria-label="Share this product">
      <span>Share this design</span>
      <a href={whatsappUrl} target="_blank" rel="noreferrer">WhatsApp <span aria-hidden="true">↗</span></a>
      <a href={facebookUrl} target="_blank" rel="noreferrer">Facebook <span aria-hidden="true">↗</span></a>
    </nav>
  );
}
