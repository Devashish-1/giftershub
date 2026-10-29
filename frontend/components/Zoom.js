'use client';
import Image from 'next/image';
import { useEffect, useState } from 'react';
export default function Zoom({ slug, name, image, gallery = [], options = {}, variantImages = [] }) {
  const images = gallery.length ? gallery : [image || `/products/${slug}.webp`];
  const colours = options.Colour?.length ? options.Colour : options.Color || [];
  const colourImages = variantImages.length === colours.length
    ? variantImages
    : colours.length === images.length ? images : [];
  const hasColourVariants = colours.length > 1 && colourImages.length === colours.length;
  const [selected, setSelected] = useState(images[0]);
  const [on, setOn] = useState(false), [o, setO] = useState('50% 50%');
  useEffect(() => setSelected(images[0]), [slug, images[0]]);
  const mv = e => { const r = e.currentTarget.getBoundingClientRect(); setO(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`); };
  return (
    <div className="product-gallery">
      <div className={`img zoom ${on ? 'on' : ''}`} onMouseEnter={() => setOn(true)} onMouseLeave={() => setOn(false)} onMouseMove={mv} onClick={() => setOn(v => !v)}>
        <span className="ph" style={{ fontSize: 90 }}>{name[0]}</span>
        <Image src={selected} alt={name} fill priority sizes="(max-width: 900px) 100vw, 50vw" style={{ zIndex: 1, transformOrigin: o, objectFit: 'contain' }} onError={e => e.currentTarget.remove()} />
        {images.length > 1 && <span className="hint">Select a catalogue view below</span>}
        {images.length === 1 && <span className="hint">Hover or tap to zoom</span>}
      </div>
      {images.length > 1 && <div className="product-gallery-thumbnails" aria-label="Product images">
        {images.map((src, index) => <button key={src} type="button" className={selected === src ? 'selected' : ''} aria-label={`View ${name}, image ${index + 1}`} aria-pressed={selected === src} onClick={() => setSelected(src)}>
          <Image src={src} alt="" width={80} height={80} loading="lazy" fetchPriority="low" sizes="80px" />
        </button>)}
      </div>}
      {hasColourVariants && <div className="product-colour-options">
        <div className="lbl">Available finishes</div>
        <div className="chips">{colours.map((colour, index) => (
          <button key={colour} type="button" className={`chip ${selected === colourImages[index] ? 'on' : ''}`} aria-pressed={selected === colourImages[index]} onClick={() => setSelected(colourImages[index])}>{colour}</button>
        ))}</div>
      </div>}
    </div>
  );
}
