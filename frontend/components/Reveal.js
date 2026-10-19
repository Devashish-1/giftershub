'use client';
import { useEffect, useRef } from 'react';
export default function Reveal({ children, className = '', as: T = 'div', style }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add('in'); io.disconnect(); } }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    io.observe(el); return () => io.disconnect();
  }, []);
  return <T ref={ref} className={`reveal ${className}`} style={style}>{children}</T>;
}
