'use client';
import { createContext, useContext, useEffect, useState } from 'react';
const Ctx = createContext(null);
export const useCart = () => useContext(Ctx);
export default function CartProvider({ children }) {
  const [items, setItems] = useState([]), [open, setOpen] = useState(false), [wish, setWish] = useState([]), [toast, setToast] = useState('');
  useEffect(() => {
    localStorage.removeItem('gh-cart');
    localStorage.removeItem('gh-wish');
    setItems([]);
    setWish([]);
  }, []);
  useEffect(() => { localStorage.setItem('gh-cart', JSON.stringify(items)); }, [items]);
  useEffect(() => { localStorage.setItem('gh-wish', JSON.stringify(wish)); }, [wish]);
  useEffect(() => { document.documentElement.classList.toggle('cart-open', open); document.body.style.overflow = open ? 'hidden' : ''; }, [open]);
  const say = m => { setToast(m); setTimeout(() => setToast(''), 1800); };
  const add = (p, variant = '', qty = 1) => setItems(l => {
    const k = p.slug + variant, f = l.find(i => i.key === k);
    return f ? l.map(i => i.key === k ? { ...i, qty: i.qty + qty } : i) : [...l, { key: k, slug: p.slug, name: p.name, price: p.price, variant, qty }];
  });
  const setQty = (key, d) => setItems(l => l.map(i => i.key === key ? { ...i, qty: i.qty + d } : i).filter(i => i.qty > 0));
  const toggleWish = s => { setWish(w => w.includes(s) ? w.filter(x => x !== s) : [...w, s]); say(wish.includes(s) ? 'Removed from wishlist' : 'Saved to wishlist'); };
  const count = items.reduce((a, i) => a + i.qty, 0);
  return <Ctx.Provider value={{ items, add, setQty, open, setOpen, count, wish, toggleWish, say, clear: () => setItems([]) }}>{children}{toast && <div className="toast">{toast}</div>}</Ctx.Provider>;
}
