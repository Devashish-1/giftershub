'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';

const Ctx = createContext(null);
export const useCart = () => useContext(Ctx);

function readStoredArray(key, validate) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter(validate) : [];
  } catch {
    return [];
  }
}

function validCartItem(item) {
  return item && typeof item.slug === 'string' && typeof item.name === 'string' &&
    Number.isFinite(item.price) && Number.isInteger(item.qty) && item.qty > 0 && item.qty <= 99 &&
    (item.variant === undefined || (typeof item.variant === 'string' && item.variant.length <= 120));
}

function toServerItems(items) {
  return items.map(({ slug, qty, variant }) => ({ slug, qty, variant: variant || '' }));
}

export default function CartProvider({ children }) {
  const { user, loading } = useAuth();
  const isAdmin = user?.role === 'admin';
  const userEmail = user?.email || '';
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [wish, setWish] = useState([]);
  const [toast, setToast] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [syncedUser, setSyncedUser] = useState('');
  const [syncing, setSyncing] = useState(false);
  const previousUser = useRef('');
  const mergeStartedFor = useRef('');
  const requestVersion = useRef(0);
  const itemsRef = useRef(items);
  const wishRef = useRef(wish);
  itemsRef.current = items;
  wishRef.current = wish;

  useEffect(() => {
    setItems(readStoredArray('gh-cart', validCartItem));
    setWish(readStoredArray('gh-wish', slug => typeof slug === 'string'));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (loading || !hydrated) return;
    if (isAdmin) {
      requestVersion.current += 1;
      setItems([]);
      setWish([]);
      setSyncedUser('');
      setSyncing(false);
      mergeStartedFor.current = '';
      previousUser.current = '';
      localStorage.removeItem('gh-cart');
      localStorage.removeItem('gh-wish');
      localStorage.removeItem('gh-cart-merge-id');
      return;
    }
    if (!userEmail) {
      if (previousUser.current) {
        requestVersion.current += 1;
        setItems([]);
        setWish([]);
        setSyncedUser('');
        setSyncing(false);
        mergeStartedFor.current = '';
      }
      previousUser.current = '';
      return;
    }
    previousUser.current = userEmail;
    if (syncedUser === userEmail || mergeStartedFor.current === userEmail) return;
    mergeStartedFor.current = userEmail;
    setSyncing(true);
    const version = ++requestVersion.current;
    let mergeId = localStorage.getItem('gh-cart-merge-id');
    if (!mergeId || !/^[a-f0-9-]{16,64}$/i.test(mergeId)) {
      mergeId = crypto.randomUUID();
      localStorage.setItem('gh-cart-merge-id', mergeId);
    }
    fetch('/api/account/shopping/merge', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: toServerItems(itemsRef.current),
        wishlist: wishRef.current,
        mergeId,
      }),
    }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not sync your saved cart.');
      if (version !== requestVersion.current) return;
      setItems(result.items || []);
      setWish(result.wishlist || []);
      setSyncedUser(userEmail);
      setSyncing(false);
      localStorage.removeItem('gh-cart');
      localStorage.removeItem('gh-wish');
      localStorage.removeItem('gh-cart-merge-id');
      if (result.unavailable?.length) say('Some cart products are no longer available and were removed.');
      if (result.unavailableWishlist?.length) say('Some saved products are no longer available.');
    }).catch(error => {
      if (version !== requestVersion.current) return;
      mergeStartedFor.current = '';
      setSyncing(false);
      say(error.message || 'Could not sync your saved cart. Please refresh to retry.');
    });
  }, [hydrated, isAdmin, loading, syncedUser, userEmail]);

  useEffect(() => {
    if (!hydrated || loading) return undefined;
    if (isAdmin) return undefined;
    if (!userEmail) {
      localStorage.setItem('gh-cart', JSON.stringify(items));
      localStorage.setItem('gh-wish', JSON.stringify(wish));
      return undefined;
    }
    if (syncedUser !== userEmail) return undefined;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/account/shopping', {
          method: 'PUT',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: toServerItems(items), wishlist: wish }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not save your cart.');
        if (result.unavailable?.length) {
          setItems(result.items || []);
          say('Some cart products are no longer available and were removed.');
        }
        if (result.unavailableWishlist?.length) {
          setWish(current => current.filter(slug => !result.unavailableWishlist.includes(slug)));
          say('Some saved products are no longer available.');
        }
      } catch (error) {
        say(error.message || 'Could not save your cart. Please try again.');
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [hydrated, isAdmin, items, loading, syncedUser, userEmail, wish]);

  useEffect(() => {
    document.documentElement.classList.toggle('cart-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  }, [open]);

  const say = useCallback(message => {
    setToast(message);
    setTimeout(() => setToast(''), 2200);
  }, []);

  const add = (product, variant = '', qty = 1) => {
    if (isAdmin) return;
    const key = product.slug + variant;
    const existing = itemsRef.current.find(item => item.key === key);
    if (!existing && itemsRef.current.length >= 30) {
      say('Your cart can contain up to 30 different products.');
      return;
    }
    if (existing && existing.qty + qty > 99) {
      say('You can add up to 99 of the same product.');
      return;
    }
    setItems(current => existing
      ? current.map(item => item.key === key ? { ...item, qty: item.qty + qty } : item)
      : [...current, { key, slug: product.slug, name: product.name, price: product.price, variant, qty }]);
  };
  const setQty = (key, delta) => setItems(current => current
    .map(item => item.key === key ? { ...item, qty: Math.min(99, item.qty + delta) } : item)
    .filter(item => item.qty > 0));
  const toggleWish = slug => {
    if (isAdmin) return;
    const removing = wishRef.current.includes(slug);
    say(removing ? 'Removed from wishlist' : 'Saved to wishlist');
    setWish(current => removing ? current.filter(value => value !== slug) : [...current, slug]);
  };
  const count = items.reduce((total, item) => total + item.qty, 0);
  return <Ctx.Provider value={{
    items, add, setQty, open, setOpen, count, wish, toggleWish, say, syncing,
    clear: () => setItems([]),
  }}>{children}{toast && <div className="toast" role="status">{toast}</div>}</Ctx.Provider>;
}
