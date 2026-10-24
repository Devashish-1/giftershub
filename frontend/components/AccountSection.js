'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { useCart } from './CartProvider';
import ProductCard from './ProductCard';
import { inr } from '../lib/api';
import { signInWithGoogle } from '../lib/firebase';

const SECTIONS = {
  overview: { title: 'Your account', description: 'Manage your details, delivery addresses, orders, and account security.' },
  profile: { title: 'Personal details', description: 'Update the contact details associated with your account.' },
  addresses: { title: 'Saved addresses', description: 'Keep delivery addresses ready for your next order.' },
  wishlist: { title: 'Wishlist & reminders', description: 'Save gift ideas and get an email nudge before birthdays and anniversaries.' },
  orders: { title: 'Your orders', description: 'Review the latest orders placed with this account.' },
  coupons: { title: 'Coupons & rewards', description: 'Browse available coupons and review your coupon redemptions.' },
  payments: { title: 'Payment methods', description: 'Manage payment options securely.' },
  notifications: { title: 'Email notifications', description: 'Choose whether to receive order updates by email.' },
  privacy: { title: 'Privacy controls', description: 'Download your account data and manage signed-in sessions.' },
  security: { title: 'Account security', description: 'Sign out or remove your customer account and personal details.' },
};

const EMPTY_ADDRESS = { label: 'Home', name: '', phone: '', pincode: '', address: '', locality: '', city: '', state: '', country: '' };

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
  const { wish } = useCart();
  const [profile, setProfile] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [defaultAddressId, setDefaultAddressId] = useState('');
  const [orders, setOrders] = useState([]);
  const [offers, setOffers] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [notificationPreferences, setNotificationPreferences] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [wishlistProducts, setWishlistProducts] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [reminderEmailConfigured, setReminderEmailConfigured] = useState(false);
  const [reminderForm, setReminderForm] = useState({ name: '', occasion: 'birthday', date: '', emailEnabled: false });
  const [exportBusy, setExportBusy] = useState(false);
  const [form, setForm] = useState(EMPTY_ADDRESS);
  const [pincodeLookup, setPincodeLookup] = useState({ pincode: '', status: 'idle', location: null });
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
      section === 'coupons' ? request('/api/account/coupons') : Promise.resolve(null),
      section === 'notifications' ? request('/api/account/preferences') : Promise.resolve(null),
      section === 'privacy' ? request('/api/account/sessions') : Promise.resolve(null),
      section === 'wishlist' ? Promise.all([request('/api/account/shopping'), request('/api/account/reminders')]) : Promise.resolve(null),
    ]).then(([profileResult, addressResult, orderResult, couponResult, preferencesResult, sessionsResult, wishlistResult]) => {
      if (!active) return;
      setProfile(profileResult.profile);
      setProfileForm({ name: profileResult.profile.name, phone: profileResult.profile.phone });
      if (addressResult) {
        setAddresses(addressResult.addresses);
        setDefaultAddressId(addressResult.defaultAddressId);
      }
      if (orderResult) setOrders(orderResult.orders);
      if (couponResult) {
        setOffers(couponResult.offers);
        setRedemptions(couponResult.redemptions);
      }
      if (preferencesResult) setNotificationPreferences(preferencesResult);
      if (sessionsResult) setSessions(sessionsResult.sessions);
      if (wishlistResult) {
        const [shoppingResult, reminderResult] = wishlistResult;
        setWishlistProducts(shoppingResult.wishlistProducts || []);
        setReminders(reminderResult.reminders || []);
        setReminderEmailConfigured(reminderResult.emailConfigured);
      }
    }).catch(loadError => {
      if (active) setError(loadError.message || 'Could not load your account details.');
    });
    return () => { active = false; };
  }, [authLoading, user, openLogin, section]);

  useEffect(() => {
    if (section !== 'addresses' || !/^[1-9]\d{5}$/.test(form.pincode)) {
      setPincodeLookup({ pincode: '', status: 'idle', location: null });
      return undefined;
    }
    const controller = new AbortController();
    const pincode = form.pincode;
    setPincodeLookup({ pincode, status: 'loading', location: null });
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/pincode/${pincode}`, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.message || 'Could not verify this pincode.');
        setPincodeLookup({ pincode, status: 'found', location: result.location });
      } catch (lookupError) {
        if (!controller.signal.aborted) {
          setPincodeLookup({ pincode, status: 'error', location: null, message: lookupError.message || 'Pincode lookup is temporarily unavailable.' });
        }
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [form.pincode, section]);

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
      if (result.defaultAddressId) setDefaultAddressId(result.defaultAddressId);
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
    setForm({ ...EMPTY_ADDRESS, ...address });
    setEditingAddress(address.id);
    setError('');
    setNotice('');
  };

  const applyPincodeLocation = () => {
    const location = pincodeLookup.location;
    if (!location || pincodeLookup.pincode !== form.pincode) return;
    setForm(current => ({
      ...current,
      locality: location.locality || current.locality,
      city: location.city || current.city,
      state: location.state || current.state,
      country: location.country || current.country,
    }));
    setPincodeLookup(current => ({ ...current, status: 'applied' }));
  };

  const removeAddress = async addressId => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await request(`/api/account/addresses/${encodeURIComponent(addressId)}`, { method: 'DELETE' });
      const remainingAddresses = addresses.filter(address => address.id !== addressId);
      setAddresses(remainingAddresses);
      if (result?.defaultAddressId !== undefined) setDefaultAddressId(result.defaultAddressId);
      else if (defaultAddressId === addressId) setDefaultAddressId(remainingAddresses[0]?.id || '');
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

  const setDefaultAddress = async addressId => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await request(`/api/account/addresses/${encodeURIComponent(addressId)}/default`, { method: 'PUT' });
      setDefaultAddressId(result.defaultAddressId);
      setNotice('Default delivery address updated.');
    } catch (saveError) {
      setError(saveError.message || 'Could not set the default address.');
    } finally {
      setBusy(false);
    }
  };

  const saveReminder = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await request('/api/account/reminders', {
        method: 'POST',
        body: JSON.stringify(reminderForm),
      });
      setReminders(current => [...current, result.reminder].sort((first, second) => first.date.localeCompare(second.date)));
      setReminderForm({ name: '', occasion: 'birthday', date: '', emailEnabled: false });
      setNotice('Your gift reminder has been saved.');
    } catch (saveError) {
      setError(saveError.message || 'Could not save this reminder.');
    } finally {
      setBusy(false);
    }
  };

  const deleteReminder = async reminderId => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await request(`/api/account/reminders/${encodeURIComponent(reminderId)}`, { method: 'DELETE' });
      setReminders(current => current.filter(reminder => reminder.id !== reminderId));
      setNotice('Gift reminder removed.');
    } catch (removeError) {
      setError(removeError.message || 'Could not remove this reminder.');
    } finally {
      setBusy(false);
    }
  };

  const saveNotificationPreferences = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await request('/api/account/preferences', {
        method: 'PUT',
        body: JSON.stringify({ orderEmail: notificationPreferences.orderEmail }),
      });
      setNotificationPreferences(current => ({ ...current, orderEmail: result.orderEmail }));
      setNotice('Email notification preferences saved.');
    } catch (saveError) {
      setError(saveError.message || 'Could not save email preferences.');
    } finally {
      setBusy(false);
    }
  };

  const downloadAccountData = async () => {
    setExportBusy(true);
    setError('');
    try {
      const response = await fetch('/api/account/export', { credentials: 'same-origin' });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Could not download your account data.');
      }
      const downloadUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = 'gifters-hub-account-data.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      setNotice('Your account data download has started.');
    } catch (downloadError) {
      setError(downloadError.message || 'Could not download your account data.');
    } finally {
      setExportBusy(false);
    }
  };

  const revokeSession = async sessionId => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await request(`/api/account/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
      setSessions(current => current.filter(session => session.id !== sessionId));
      setNotice('Session signed out.');
    } catch (revokeError) {
      setError(revokeError.message || 'Could not revoke this session.');
    } finally {
      setBusy(false);
    }
  };

  const revokeOtherSessions = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await request('/api/account/sessions/others', { method: 'DELETE' });
      setSessions(current => current.filter(session => session.current));
      setNotice('All other sessions have been signed out.');
    } catch (revokeError) {
      setError(revokeError.message || 'Could not sign out other sessions.');
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
          <label>Pincode<input required inputMode="numeric" maxLength={6} pattern="[1-9][0-9]{5}" autoComplete="postal-code" value={form.pincode} onChange={event => {
            const pincode = event.target.value.replace(/\D/g, '').slice(0, 6);
            setForm(current => current.pincode === pincode ? current : { ...current, pincode, locality: '', city: '', state: '', country: '' });
          }} /></label>
          {pincodeLookup.pincode === form.pincode && pincodeLookup.status === 'loading' && <p className="pincode-lookup-message" role="status">Checking pincode…</p>}
          {pincodeLookup.pincode === form.pincode && pincodeLookup.status === 'found' && <div className="pincode-suggestion" role="status">
            <p>We found {pincodeLookup.location.locality}, {pincodeLookup.location.city}, {pincodeLookup.location.state}, {pincodeLookup.location.country}. Add these location details?</p>
            <button type="button" onClick={applyPincodeLocation}>Use these details</button>
          </div>}
          {pincodeLookup.pincode === form.pincode && pincodeLookup.status === 'applied' && <p className="pincode-lookup-message" role="status">Location details added. You can edit them below.</p>}
          {pincodeLookup.pincode === form.pincode && pincodeLookup.status === 'error' && <p className="pincode-lookup-error" role="status">{pincodeLookup.message} You can enter the location manually.</p>}
          <label>Area / post office<input autoComplete="address-level3" maxLength={100} value={form.locality} onChange={event => setForm(current => ({ ...current, locality: event.target.value }))} /></label>
          <label>City / district<input autoComplete="address-level2" maxLength={100} value={form.city} onChange={event => setForm(current => ({ ...current, city: event.target.value }))} /></label>
          <label>State<input autoComplete="address-level1" maxLength={100} value={form.state} onChange={event => setForm(current => ({ ...current, state: event.target.value }))} /></label>
          <label>Country<input autoComplete="country-name" maxLength={100} value={form.country} onChange={event => setForm(current => ({ ...current, country: event.target.value }))} /></label>
          <label>Full address<textarea required minLength={8} maxLength={500} rows={3} autoComplete="street-address" value={form.address} onChange={event => setForm(current => ({ ...current, address: event.target.value }))} /></label>
          <div className="account-form-actions"><button className="btn alt" type="submit" disabled={busy}>{busy ? 'Saving…' : editingAddress ? 'Update address' : 'Save address'}</button>{editingAddress && <button type="button" onClick={() => { setEditingAddress(''); setForm(EMPTY_ADDRESS); }}>Cancel</button>}</div>
        </form>
        <div className="account-address-list">
          {addresses.length ? addresses.map(address => <article className="account-panel account-address" key={address.id}>
            <span>{address.label}{defaultAddressId === address.id ? ' · Default' : ''}</span><strong>{address.name}</strong><p>{address.address}</p>
            {(address.locality || address.city || address.state || address.country) && <p>{[address.locality, address.city, address.state, address.country].filter(Boolean).join(', ')}</p>}
            <p>{address.pincode} · {address.phone}</p>
            <div>{defaultAddressId !== address.id && <button type="button" disabled={busy} onClick={() => setDefaultAddress(address.id)}>Set as default</button>}<button type="button" onClick={() => editAddress(address)}>Edit</button><button type="button" disabled={busy} onClick={() => removeAddress(address.id)}>Remove</button></div>
          </article>) : <p className="account-empty">No saved addresses yet. Add one to make checkout quicker.</p>}
        </div>
      </div>}

      {section === 'coupons' && <div className="account-security">
        <article className="account-panel"><h2>Available coupons</h2>
          <p>Current rewards are coupon offers; points are not enabled yet.</p>
          <div className="account-coupon-list">{offers.map(offer => <article className="account-coupon" key={offer.code}>
            <strong>{offer.code}</strong><span>{offer.description}</span><small>{offer.minimumSpend ? `Minimum order ${inr(offer.minimumSpend)}` : 'No minimum order'}</small>
          </article>)}</div>
          <p>Apply a coupon in your cart before checkout. Offers are subject to eligibility.</p>
        </article>
        <article className="account-panel"><h2>Redemption history</h2>
          {redemptions.length ? <div className="account-coupon-list">{redemptions.map(redemption => <article className="account-coupon" key={redemption.orderId}>
            <strong>{redemption.couponCode} · Order {redemption.orderId}</strong>
            <span>{redemption.off ? `${inr(redemption.off)} saved` : 'Coupon used'}</span>
            <small>{redemption.createdAt ? new Date(redemption.createdAt).toLocaleDateString() : ''} · {redemption.status}</small>
          </article>)}</div> : <p className="account-empty">No coupon redemptions yet.</p>}
        </article>
      </div>}

      {section === 'wishlist' && <div className="account-wishlist-layout">
        <section className="account-wishlist-products" aria-labelledby="wishlist-products-title">
          <div className="account-subheading"><h2 id="wishlist-products-title">Saved gift ideas</h2><p>Tap the heart on any product to save it here.</p></div>
          {wishlistProducts.filter(product => wish.includes(product.slug)).length
            ? <div className="grid">{wishlistProducts.filter(product => wish.includes(product.slug)).map(product => <ProductCard key={product.slug} p={product} />)}</div>
            : <div className="account-panel account-empty">Your wishlist is empty. <Link href="/shop">Browse gifts and save your favourites →</Link></div>}
        </section>
        <section className="account-reminders" aria-labelledby="gift-reminders-title">
          <div className="account-subheading"><h2 id="gift-reminders-title">Birthday &amp; anniversary reminders</h2><p>We’ll send one email reminder during the week before each date.</p></div>
          <form className="account-panel account-form" onSubmit={saveReminder}>
            {!reminderEmailConfigured && <p className="account-message account-error">Email reminders are unavailable until the email service is configured.</p>}
            <label>Person’s name<input required minLength={2} maxLength={80} value={reminderForm.name} onChange={event => setReminderForm(current => ({ ...current, name: event.target.value }))} /></label>
            <label>Occasion<select value={reminderForm.occasion} onChange={event => setReminderForm(current => ({ ...current, occasion: event.target.value }))}><option value="birthday">Birthday</option><option value="anniversary">Anniversary</option></select></label>
            <label>Date<input required type="date" value={reminderForm.date} onChange={event => setReminderForm(current => ({ ...current, date: event.target.value }))} /></label>
            <label className="account-checkbox"><input required type="checkbox" checked={reminderForm.emailEnabled} onChange={event => setReminderForm(current => ({ ...current, emailEnabled: event.target.checked }))} />Email me a reminder before this date</label>
            <button className="btn alt" type="submit" disabled={busy || !reminderEmailConfigured}>{busy ? 'Saving…' : 'Save reminder'}</button>
          </form>
          <div className="account-reminder-list">
            {reminders.length ? reminders.map(reminder => <article className="account-panel account-reminder" key={reminder.id}>
              <div><strong>{reminder.name} · {reminder.occasion}</strong><span>{new Date(`${reminder.date}T00:00:00`).toLocaleDateString()}</span></div>
              <button type="button" disabled={busy} onClick={() => deleteReminder(reminder.id)}>Remove</button>
            </article>) : <p className="account-empty">No reminders saved yet.</p>}
          </div>
        </section>
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

      {section === 'notifications' && notificationPreferences && <form className="account-panel account-form" onSubmit={saveNotificationPreferences}>
        <h2>Order updates by email</h2>
        <p>Get an email when an order is placed and when its order or payment status changes.</p>
        <p>Sent to <strong>{notificationPreferences.email}</strong>.</p>
        {!notificationPreferences.emailConfigured && <p className="account-message account-error">Email notifications are temporarily unavailable because the email service is not configured.</p>}
        <label className="account-checkbox"><input type="checkbox" checked={notificationPreferences.orderEmail} disabled={!notificationPreferences.emailConfigured} onChange={event => setNotificationPreferences(current => ({ ...current, orderEmail: event.target.checked }))} />Email me about my orders</label>
        <button className="btn alt" type="submit" disabled={busy || !notificationPreferences.emailConfigured}>{busy ? 'Saving…' : 'Save preferences'}</button>
      </form>}

      {section === 'privacy' && <div className="account-security">
        <article className="account-panel"><h2>Download your data</h2><p>Export your profile, addresses, cart, wishlist, gift reminders, preferences, and order history as a JSON file.</p><button className="btn alt" type="button" disabled={exportBusy} onClick={downloadAccountData}>{exportBusy ? 'Preparing download…' : 'Download account data'}</button></article>
        <article className="account-panel"><h2>Signed-in sessions</h2><p>Review active sign-ins for this account. This device is marked as the current session.</p>
          <div className="account-session-list">{sessions.map(session => <div className="account-session" key={session.id}>
            <div><strong>{session.current ? 'This device · Current session' : 'Signed-in session'}</strong><span>Signed in {new Date(session.createdAt).toLocaleString()} · Expires {new Date(session.expiresAt).toLocaleDateString()}</span></div>
            {!session.current && <button type="button" disabled={busy} onClick={() => revokeSession(session.id)}>Sign out</button>}
          </div>)}</div>
          {sessions.some(session => !session.current) && <button className="account-signout" type="button" disabled={busy} onClick={revokeOtherSessions}>Sign out all other sessions</button>}
          {!sessions.length && <p className="account-empty">No active sessions found.</p>}
        </article>
      </div>}

      {section === 'security' && <div className="account-security">
        <article className="account-panel"><h2>Sign out</h2><p>Sign out of this account on this device.</p><button className="account-signout" type="button" onClick={logout}>Sign out</button></article>
        <article className="account-panel account-danger"><h2>Delete account</h2>
          {profile.isAdmin
            ? <p>Administrator access is managed using backend credentials. To remove an administrator, update those credentials on the backend.</p>
            : <>
              <p>This permanently removes your account, saved addresses, cart, wishlist, gift reminders, and active sessions. Personal details and gift messages on past orders are erased; anonymized order totals and items are retained for store records. This cannot be undone.</p>
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
