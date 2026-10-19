'use client';
import { useState } from 'react';
export default function Zoom({ slug, name, image }) {
  const [on, setOn] = useState(false), [o, setO] = useState('50% 50%');
  const mv = e => { const r = e.currentTarget.getBoundingClientRect(); setO(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`); };
  return (
    <div className={`img zoom ${on ? 'on' : ''}`} onMouseEnter={() => setOn(true)} onMouseLeave={() => setOn(false)} onMouseMove={mv} onClick={() => setOn(v => !v)}>
      <span className="ph" style={{ fontSize: 90 }}>{name[0]}</span>
      <img src={image || `/products/${slug}.jpg`} alt={name} style={{ zIndex: 1, transformOrigin: o }} onError={e => e.currentTarget.remove()} />
      <span className="hint">Hover or tap to zoom</span>
    </div>
  );
}
