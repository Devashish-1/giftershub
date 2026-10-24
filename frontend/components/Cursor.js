'use client';
import { useEffect, useRef } from 'react';
export default function Cursor() {
  const dot = useRef(null), ring = useRef(null), bar = useRef(null);
  useEffect(() => {
    let previousScrollTop = document.documentElement.scrollTop;
    const onScroll = () => {
      const h = document.documentElement;
      const scrollTop = h.scrollTop;
      if (bar.current) bar.current.style.transform = `scaleX(${scrollTop / (h.scrollHeight - h.clientHeight || 1)})`;
      document.body.classList.toggle('scrolled', scrollTop > 40);

      if (scrollTop <= 40) {
        document.body.classList.remove('header-hidden');
      } else if (scrollTop > previousScrollTop + 3 &&
        !document.querySelector('.mobile-navigation, .auth-overlay') &&
        !document.querySelector('header.top :focus')) {
        document.body.classList.add('header-hidden');
      } else if (scrollTop < previousScrollTop - 1) {
        document.body.classList.remove('header-hidden');
      }
      previousScrollTop = scrollTop;
    };
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
    if (!window.matchMedia('(hover:hover) and (pointer:fine)').matches || window.matchMedia('(prefers-reduced-motion:reduce)').matches) {
      return () => {
        window.removeEventListener('scroll', onScroll);
        document.body.classList.remove('header-hidden');
      };
    }
    document.body.classList.add('has-cursor');
    let x = -100, y = -100, rx = x, ry = y, raf;
    const move = e => { x = e.clientX; y = e.clientY; if (dot.current) dot.current.style.transform = `translate(${x}px,${y}px)`; };
    const loop = () => { rx += (x - rx) * .16; ry += (y - ry) * .16; if (ring.current) ring.current.style.transform = `translate(${rx}px,${ry}px)`; raf = requestAnimationFrame(loop); };
    const over = e => {
      const t = e.target.closest?.('a,button,input,summary,.chip,.card .img,.zoom');
      const img = e.target.closest?.('.card .img,.zoom');
      ring.current?.classList.toggle('hot', !!t); ring.current?.classList.toggle('view', !!img);
      if (ring.current) ring.current.dataset.label = e.target.closest?.('.zoom') ? 'Zoom' : img ? 'View' : '';
    };
    const down = () => ring.current?.classList.add('press'), up = () => ring.current?.classList.remove('press');
    const click = e => { const r = document.createElement('span'); r.className = 'ripple'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'; document.body.appendChild(r); setTimeout(() => r.remove(), 600); };
    window.addEventListener('mousemove', move); document.addEventListener('mouseover', over);
    window.addEventListener('mousedown', down); window.addEventListener('mouseup', up); window.addEventListener('click', click);
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', onScroll); window.removeEventListener('mousemove', move); document.removeEventListener('mouseover', over); window.removeEventListener('mousedown', down); window.removeEventListener('mouseup', up); window.removeEventListener('click', click); document.body.classList.remove('has-cursor', 'header-hidden'); };
  }, []);
  return <><div className="progress"><i ref={bar} /></div><div className="cur-ring" ref={ring} /><div className="cur-dot" ref={dot} /></>;
}
