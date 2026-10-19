'use client';
import { useEffect, useRef, useState } from 'react';

const CONTACTS = [
  { name: 'Call', href: 'tel:+919555532044', className: 'contact-call', icon: 'phone' },
  { name: 'WhatsApp', href: 'https://wa.me/919555532044', className: 'contact-whatsapp', icon: 'whatsapp' },
  { name: 'Instagram', href: 'https://www.instagram.com/thegiftershub/', className: 'contact-instagram', icon: 'instagram' },
  { name: 'Facebook', href: 'https://www.facebook.com/p/thegiftershub-61563390688639', className: 'contact-facebook', icon: 'facebook' },
];

function ContactIcon({ name }) {
  if (name === 'phone') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.8 9.5 3l2 4.6-2 1.7a14 14 0 0 0 5.2 5.2l1.7-2 4.6 2-.8 2.5a3 3 0 0 1-3.2 2.1A15.8 15.8 0 0 1 4.9 7a3 3 0 0 1 2.1-3.2Z" /></svg>;
  if (name === 'whatsapp') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.7a8 8 0 0 1-11.8 7l-4 .9 1-3.9A8 8 0 1 1 20 11.7Z" /><path d="M8.4 7.7c.2-.4.4-.4.7-.4h.5c.2 0 .3.1.4.4l.8 1.8c.1.2.1.4-.1.6l-.6.7c-.2.2-.2.4 0 .7.5.9 1.3 1.7 2.3 2.2.3.2.5.2.7-.1l.8-1c.2-.2.4-.2.6-.1l1.7.8c.2.1.4.2.4.4 0 .3-.2 1.2-.8 1.6-.5.5-1.2.7-1.9.6-1.2-.2-2.6-.9-4-2.1-1.1-1-2-2.3-2.3-3.4-.3-1.1.3-2.1.8-2.7Z" /></svg>;
  if (name === 'instagram') return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle className="icon-fill" cx="17.7" cy="6.7" r="1" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path className="icon-fill" d="M13.7 21v-8.2h2.8l.4-3.2h-3.2v-2c0-.9.3-1.5 1.6-1.5H17V3.2c-.3 0-1.3-.2-2.5-.2-2.5 0-4.2 1.5-4.2 4.4v2.2H7.5v3.2h2.8V21h3.4Z" /></svg>;
}

export default function ContactWidget({ productPage = false }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = event => {
      if (event.key === 'Escape') setOpen(false);
    };
    const closeOnOutsideClick = event => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('click', closeOnOutsideClick);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('click', closeOnOutsideClick);
    };
  }, [open]);

  return (
    <div className={`contact-widget${productPage ? ' product-page' : ''}`} ref={root}>
      <div className={`contact-options${open ? ' is-open' : ''}`} id="contact-options" aria-hidden={!open}>
        {CONTACTS.map(({ name, href, className, icon }, index) => (
          <a
            className={`contact-option ${className}`}
            href={href}
            key={name}
            target={icon === 'instagram' || icon === 'facebook' || icon === 'whatsapp' ? '_blank' : undefined}
            rel={icon === 'instagram' || icon === 'facebook' || icon === 'whatsapp' ? 'noreferrer' : undefined}
            aria-label={name}
            title={name}
            tabIndex={open ? 0 : -1}
            style={{ '--contact-index': index }}
          >
            <ContactIcon name={icon} />
          </a>
        ))}
      </div>
      <button
        className={`contact-trigger${open ? ' is-open' : ''}`}
        type="button"
        aria-expanded={open}
        aria-controls="contact-options"
        aria-label={open ? 'Close contact options' : 'Open contact options'}
        title={open ? 'Close contact options' : 'Contact us'}
        onClick={() => setOpen(value => !value)}
      >
        {open
          ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          : <ContactIcon name="phone" />}
      </button>
    </div>
  );
}
