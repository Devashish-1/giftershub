'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const pendingAction = useRef(null);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not check your sign-in status.');
        if (active) setUser(result.user);
      })
      .catch(() => {
        if (active) setError('We could not check your sign-in status. Please refresh and try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (loading || !pendingAction.current) return;
    if (user) {
      const action = pendingAction.current;
      pendingAction.current = null;
      action();
    } else {
      setOpen(true);
    }
  }, [loading, user]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = event => {
      if (event.key === 'Escape' && !busy) setOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open, busy]);

  const openLogin = useCallback(() => {
    pendingAction.current = null;
    setMode('login');
    setError('');
    setOpen(true);
  }, []);

  const requireAuth = useCallback(action => {
    if (loading) {
      pendingAction.current = action;
      return;
    }
    if (user) {
      action();
      return;
    }
    pendingAction.current = action;
    setMode('login');
    setError('');
    setOpen(true);
  }, [loading, user]);

  const logout = useCallback(async () => {
    setError('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Could not sign out. Please try again.');
      }
      setUser(null);
    } catch (requestError) {
      setError(requestError.message || 'Could not sign out. Please try again.');
    }
  }, []);

  const submit = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/auth/${mode === 'register' ? 'register' : 'login'}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not sign in. Please try again.');
      setUser(result.user);
      setOpen(false);
      setForm({ name: '', email: '', password: '' });
      const action = pendingAction.current;
      pendingAction.current = null;
      if (action) action();
    } catch (requestError) {
      setError(requestError.message || 'Could not connect to the account service. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const switchMode = nextMode => {
    setMode(nextMode);
    setError('');
    setForm(current => ({ ...current, password: '' }));
  };

  return (
    <AuthContext.Provider value={{ user, loading, openLogin, requireAuth, logout, authError: error }}>
      {children}
      {open && <div className="auth-overlay" onMouseDown={event => {
        if (event.target === event.currentTarget && !busy) setOpen(false);
      }}>
        <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
          <button className="auth-close" type="button" aria-label="Close sign-in" onClick={() => setOpen(false)} disabled={busy}>×</button>
          <div className="auth-eyebrow">The Gifter’s Hub</div>
          <h2 id="auth-title">{mode === 'register' ? 'Create your account' : 'Sign in'}</h2>
          <p className="auth-intro">{mode === 'register' ? 'Create an account to continue with your cart and checkout.' : 'Sign in to continue with your cart and checkout.'}</p>
          <form onSubmit={submit} className="auth-form">
            {mode === 'register' && <label>Your name
              <input required autoComplete="name" minLength={2} maxLength={100} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
            </label>}
            <label>Email address
              <input required type="email" autoComplete="email" maxLength={254} value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} />
            </label>
            <label>Password
              <input required type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={mode === 'register' ? 10 : 1} maxLength={128} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} />
              {mode === 'register' && <small>Use at least 10 characters.</small>}
            </label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="btn alt auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Continue'}</button>
          </form>
          <p className="auth-switch">
            {mode === 'register' ? 'Already have an account?' : 'New to The Gifter’s Hub?'}{' '}
            <button type="button" onClick={() => switchMode(mode === 'register' ? 'login' : 'register')} disabled={busy}>
              {mode === 'register' ? 'Sign in' : 'Create account'}
            </button>
          </p>
        </section>
      </div>}
    </AuthContext.Provider>
  );
}
