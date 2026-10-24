'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from './AuthProvider';

const NAVIGATION = [
  { label: 'Overview', href: '/admin/vyapaar', icon: '◫' },
  { label: 'Items & Inventory', href: '/admin/vyapaar/items', icon: '▤' },
  { label: 'Categories & Units', href: '/admin/vyapaar/categories', icon: '▦' },
  { label: 'Data Import', href: '/admin/vyapaar/import', icon: '⇧' },
  { label: 'Stock Adjustments', href: '/admin/vyapaar/stock', icon: '↕' },
  { label: 'Purchases', href: '/admin/vyapaar/purchases', icon: '↓' },
  { label: 'Sales & Invoices', href: '/admin/vyapaar/sales', icon: '▧' },
  { label: 'Analytics & Alerts', href: '/admin/vyapaar/analytics', icon: '⌁' },
  { label: 'Returns', href: '/admin/vyapaar/returns', icon: '↩' },
  { label: 'Expenses', href: '/admin/vyapaar/expenses', icon: '−' },
  { label: 'Cash & Bank', href: '/admin/vyapaar/cashbook', icon: '₹' },
  { label: 'Reports', href: '/admin/vyapaar/reports', icon: '▥' },
  { label: 'Barcode Labels', href: '/admin/vyapaar/barcodes', icon: '▤' },
  { label: 'Activity Log', href: '/admin/vyapaar/activity', icon: '◷' },
  { label: 'Customers & Suppliers', href: '/admin/vyapaar/parties', icon: '♧' },
  { label: 'Business Settings', href: '/admin/vyapaar/settings', icon: '⚙' },
];

export default function VyapaarShell({ children }) {
  const pathname = usePathname();
  const { user, loading, openLogin } = useAuth();

  useEffect(() => {
    if (!loading && !user) openLogin();
  }, [loading, user, openLogin]);

  if (loading || !user) {
    return <div className="wrap vyapaar-loading">Checking administrator access…</div>;
  }

  if (user.role !== 'admin') {
    return <div className="wrap vyapaar-loading"><p className="admin-denied">Administrator access is required for Vyapaar.</p></div>;
  }

  return (
    <div className="vyapaar-layout">
      <aside className="vyapaar-sidebar" aria-label="Vyapaar business navigation">
        <Link className="vyapaar-brand" href="/admin/vyapaar">
          <span className="vyapaar-brand-mark" aria-hidden="true">V</span>
          <span><b>Vyapaar</b><small>BY THE GIFTERS HUB</small></span>
        </Link>
        <Link className="vyapaar-back-link" href="/admin">← Admin dashboard</Link>
        <span className="vyapaar-nav-label">BUSINESS</span>
        <nav className="vyapaar-nav">
          {NAVIGATION.map(item => {
            const active = item.href === '/admin/vyapaar'
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link className={active ? 'active' : ''} href={item.href} key={item.href} aria-label={item.label} title={item.label} aria-current={active ? 'page' : undefined}>
                <span aria-hidden="true">{item.icon}</span><span className="vyapaar-nav-text">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="vyapaar-sidebar-footer"><span className="vyapaar-status-dot" />Inventory and invoicing tools</div>
      </aside>
      <main className="vyapaar-main">
        {children}
      </main>
    </div>
  );
}
