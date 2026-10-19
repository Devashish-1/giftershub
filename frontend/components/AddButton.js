'use client';
import { useState } from 'react';
import { useCart } from './CartProvider';
export default function AddButton({ product, variant = '', qty = 1, className = 'btn', label = 'Add to Cart', openDrawer = true }) {
  const { add, setOpen } = useCart(); const [s, set] = useState('idle');
  const click = e => { e.preventDefault(); if (s !== 'idle') return; set('adding');
    setTimeout(() => { add(product, variant, qty); set('done'); if (openDrawer) setOpen(true); setTimeout(() => set('idle'), 1400); }, 400); };
  return <button className={`${className} ${s === 'done' ? 'done' : ''}`} disabled={s === 'adding'} onClick={click}>{s === 'adding' ? 'Adding…' : s === 'done' ? 'Added ✓' : label}</button>;
}
