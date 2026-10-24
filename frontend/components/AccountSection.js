'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { inr } from '../lib/api';
import { signInWithGoogle } from '../lib/firebase';

const SECTIONS = {
  overview: { title: 'Your account', description: 'Manage your details, delivery addresses, orders, and account security.' },
  profile: { title: 'Personal details', description: 'Update the contact details associated with your account.' },
  addresses: { title: 'Saved addresses', description: 'Keep delivery addresses ready for your next order.' },
  orders: { title: 'Your orders', description: 'Review the latest orders placed with this account.' },
  payments: { title: 'Payment methods', description: 'Manage payment options securely.' },
  security: { title: 'Account security', description: 'Sign out or remove your customer account and personal details.' },
};

const EMPTY_ADDRESS = { label: 'Home', name: '', phone: '', pincode: '', address: '' };

async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  });
  if (response.status === 204) return null;
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The request could not be completed.');
  return result;
}

export default function AccountSection({ section }) {
  const { user, loading: authLoading, openLogin, logout, finishAccountDeletion } = useAuth();
  const [profile, setProfile] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState(EMPTY_ADDRESS);
  const [editingAddress, setEditingAddress] = useState('');
  const [profileForm, setProfileForm] = useState({ name: '', phone: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [deletionOpen, setDeletionOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      openLogin();
      return;
    }
    let active = true;
    setError('');
    setNotice('');
    Promise.all([
      request('/api/account/profile'),
      section === 'addresses' ? request('/api/account/addresses') : Promise.resolve(null),
      section === 'orders' ? request('/api/account/orders') : Promise.resolve(null),
    ]).then(([profileResult, addressResult, orderResult]) => {
      if (!active) return;
      setProfile(profileResult.profile);
      setProfileForm({ name: profileResult.profile.name, phone: profileResult.profile.phone });
      if (addressResult) setAddresses(addressResult.addresses);
      if (orderResult) setOrders(orderResult.orders);
    }).catch(loadError => {
      if (active) setError(loadError.message || 'Could not load your account details.');
    });
    return () => { active = false; };
  }, [authLoading, user, openLogin, section]);

  const saveProfile = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await request('/api/account/profile', {
        method: 'PUT',
        body: JSON.stringify(profileForm),
      });
      setProfile(result.profile);
      setNotice('Your personal details have been saved.');
    } catch (saveError) {
      setError(saveError.message || 'Could not save your personal details.');
    } finally {
      setBusy(false);
    }
  };

  const saveAddress = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await request(editingAddress
        ? `/api/account/addresses/${encodeURIComponent(editingAddress)}`
        : '/api/account/addresses', {
        method: editingAddress ? 'PUT' : 'POST',
        body: JSON.stringify(form),
      });
      setAddresses(current => editingAddress
        ? current.map(address => address.id === editingAddress ? result.address : address)
        : [...current, result.address]);
      setForm(EMPTY_ADDRESS);
      setEditingAddress('');
      setNotice(editingAddress ? 'Address updated.' : 'Address saved.');
    } catch (saveError) {
      setError(saveError.message || 'Could not save this address.');
    } finally {
      setBusy(false);
    }
  };

  const editAddress = address => {
    setForm({ label: address.label, name: address.name, phone: address.phone, pincode: address.pincode, address: address.address });
    setEditingAddress(address.id);
    setError('');
    setNotice('');
  };

  const removeAddress = async addressId => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await request(`/api/account/addresses/${encodeURIComponent(addressId)}`, { method: 'DELETE' });
      setAddresses(current => current.filter(address => address.id !== addressId));
      if (editingAddress === addressId) {
        setEditingAddress('');
        setForm(EMPTY_ADDRESS);
      }
      setNotice('Address removed.');
    } catch (removeError) {
      setError(removeError.message || 'Could not remove this address.');
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = { confirmation };
      if (profile?.hasPassword) body.password = password;
      else body.idToken = await signInWithGoogle();
      await request('/api/account', { method: 'DELETE', body: JSON.stringify(body) });
      finishAccountDeletion();
    } catch (deleteError) {
      setError(deleteError.message || 'Could not delete your account.');
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || !user || !profile) {
    return <section className="wrap account-page"><p>{!user && !authLoading ? 'Sign in to view your account.' : 'Loading your account…'}</p></section>;
  }

  const heading = SECTIONS[section] || SECTIONS.overview;
  return (
    <section className="wrap account-page">
      <header className="account-heading">
        <div><span className="account-eyebrow">THE GIFTER’S HUB</span><h1>{heading.title}</h1><p>{heading.description}</p></div>
      </header>
      <nav className="account-tabs" aria-label="Account sections">
        {Object.entries(SECTIONS).filter(([key]) => key !== 'overview').map(([key, value]) => (
          <Link key={key} href={key === 'overview' ? '/account' : `/account/${key}`} aria-current={section === key ? 'page' : undefined}>{value.title}</Link>
        ))}
      </nav>
      {error && <p className="account-message account-error" role="alert">{error}</p>}
      {notice && <p className="account-message account-notice" role="status">{notice}</p>}

      {section === 'overview' && <div className="account-overview">
        <article className="account-welcome"><span>Signed in as</span><h2>{profile.name}</h2><p>{profile.email}</p><Link href="/account/profile">Edit personal details →</Link></article>
        <div className="account-cards">
          {Object.entries(SECTIONS).filter(([key]) => key !== 'overview').map(([key, value]) => (
            <Link className="account-card" key={key} href={`/account/${key}`}><span>{value.title}</span><p>{value.description}</p><b>Open →</b></Link>
          ))}
        </div>
        <button className="account-signout" type="button" onClick={logout}>Sign out</button>
      </div>}

      {section === 'profile' && <form className="account-panel account-form" onSubmit={saveProfile}>
        <label>Full name<input required minLength={2} maxLength={100} autoComplete="name" value={profileForm.name} onChange={event => setProfileForm(current => ({ ...current, name: event.target.value }))} /></label>
        <label>Email address<input type="email" value={profile.email} readOnly /></label>
        <small>Email changes require verification and aren’t available here yet.</small>
        <label>Mobile number<input inputMode="numeric" autoComplete="tel-national" maxLength={10} pattern="[0-9]{10}" value={profileForm.phone} onChange={event => setProfileForm(current => ({ ...current, phone: event.target.value.replace(/\D/g, '').slice(0, 10) }))} placeholder="10-digit mobile number" /></label>
        <button className="btn alt" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </form>}

      {section === 'addresses' && <div className="account-columns">
        <form className="account-panel account-form" onSubmit={saveAddress}>
          <h2>{editingAddress ? 'Edit address' : 'Add an address'}</h2>
          <label>Address label<select value={form.label} onChange={event => setForm(current => ({ ...current, label: event.target.value }))}><option>Home</option><option>Work</option><option>Other</option></select></label>
          <label>Contact name<input required minLength={2} maxLength={100} autoComplete="name" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} /></label>
          <label>Mobile number<input required inputMode="numeric" maxLength={10} pattern="[0-9]{10}" autoComplete="tel-national" value={form.phone} onChange={event => setForm(current => ({ ...current, phone: event.target.value.replace(/\D/g, '').slice(0, 10) }))} /></label>
          <label>Pincode<input required inputMode="numeric" maxLength={6} pattern="[1-9][0-9]{5}" autoComplete="postal-code" value={form.pincode} onChange={event => setForm(current => ({ ...current, pincode: event.target.value.replace(/\D/g, '').slice(0, 6) }))} /></label>
          <label>Full address<textarea required minLength={8} maxLength={500} rows={3} autoComplete="street-address" value={form.address} onChange={event => setForm(current => ({ ...current, address: event.target.value }))} /></label>
          <div className="account-form-actions"><button className="btn alt" type="submit" disabled={busy}>{busy ? 'Saving…' : editingAddress ? 'Update address' : 'Save address'}</button>{editingAddress && <button type="button" onClick={() => { setEditingAddress(''); setForm(EMPTY_ADDRESS); }}>Cancel</button>}</div>
        </form>
        <div className="account-address-list">
          {addresses.length ? addresses.map(address => <article className="account-panel account-address" key={address.id}>
            <span>{address.label}</span><strong>{address.name}</strong><p>{address.address}</p><p>{address.pincode} · {address.phone}</p>
            <div><button type="button" onClick={() => editAddress(address)}>Edit</button><button type="button" disabled={busy} onClick={() => removeAddress(address.id)}>Remove</button></div>
          </article>) : <p className="account-empty">No saved addresses yet. Add one to make checkout quicker.</p>}
        </div>
      </div>}

      {section === 'orders' && <div className="account-order-list">
        {orders.length ? orders.map(order => <article className="account-panel account-order" key={order.orderId}>
          <div><span>Order {order.orderId}</span><b>{new Date(order.createdAt).toLocaleDateString()}</b></div>
          <p>{order.lines.map(line => `${line.name} × ${line.qty}`).join(', ')}</p>
          <div><span>{order.status} · {order.paymentStatus}</span><strong>{inr(order.total)}</strong></div>
        </article>) : <div className="account-panel account-empty">No orders have been placed with this account yet. <Link href="/shop">Browse the shop →</Link></div>}
      </div>}

      {section === 'payments' && <article className="account-panel account-payment-placeholder">
        <span className="account-payment-icon" aria-hidden="true">▣</span><h2>Saved cards are coming soon</h2>
        <p>Secure card saving will be available after payment-provider setup. Card numbers and CVV are not stored on this website.</p>
        <span className="account-status">No cards saved</span>
      </article>}

      {section === 'security' && <div className="account-security">
        <article className="account-panel"><h2>Sign out</h2><p>Sign out of this account on this device.</p><button className="account-signout" type="button" onClick={logout}>Sign out</button></article>
        <article className="account-panel account-danger"><h2>Delete account</h2>
          {profile.isAdmin
            ? <p>Administrator access is managed using backend credentials. To remove an administrator, update those credentials on the backend.</p>
            : <>
              <p>This permanently removes your account, saved addresses, and active sessions. Personal details and gift messages on past orders are erased; anonymized order totals and items are retained for store records. This cannot be undone.</p>
              {!deletionOpen
                ? <button className="account-delete" type="button" onClick={() => setDeletionOpen(true)}>Delete my account</button>
                : <form className="account-form" onSubmit={deleteAccount}>
                  <label>Type DELETE to confirm<input required autoComplete="off" value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
                  {profile.hasPassword
                    ? <label>Current password<input required type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} /></label>
                    : <p>You’ll be asked to verify the Google account linked to this profile.</p>}
                  <div className="account-form-actions"><button className="account-delete" type="submit" disabled={busy || confirmation !== 'DELETE'}>{busy ? 'Deleting…' : 'Permanently delete account'}</button><button type="button" disabled={busy} onClick={() => { setDeletionOpen(false); setConfirmation(''); setPassword(''); }}>Cancel</button></div>
                </form>}
            </>}
        </article>
      </div>}
    </section>
  );
}
