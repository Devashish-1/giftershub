'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithGoogle } from '../lib/firebase';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('login');
  const [method, setMethod] = useState('choose');
  const [resetStage, setResetStage] = useState('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', code: '' });
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
    setMethod('choose');
    setError('');
    setNotice('');
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
    setMethod('choose');
    setError('');
    setNotice('');
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
      router.replace('/');
    } catch (requestError) {
      setError(requestError.message || 'Could not sign out. Please try again.');
    }
  }, [router]);
  const finishAccountDeletion = useCallback(() => {
    setUser(null);
    router.replace('/');
  }, [router]);

  const submit = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (mode === 'forgot') {
        const requestingCode = resetStage === 'email';
        const response = await fetch(`/api/auth/password-reset/${requestingCode ? 'request' : 'confirm'}`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestingCode
            ? { email: form.email }
            : { email: form.email, code: form.code, password: form.password }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not reset your password. Please try again.');
        if (requestingCode) {
          setResetStage('code');
          setForm(current => ({ ...current, code: '', password: '' }));
          setNotice('If an account exists for this email, a reset code has been sent.');
        } else {
          setMode('login');
          setResetStage('email');
          setForm(current => ({ ...current, code: '', password: '' }));
          setNotice('Password updated. Please sign in with your new password.');
        }
        return;
      }

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
      setForm({ name: '', email: '', password: '', code: '' });
      setNotice('');
      const action = pendingAction.current;
      pendingAction.current = null;
      if (action) action();
      else router.push('/account');
    } catch (requestError) {
      setError(requestError.message || 'Could not connect to the account service. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const switchMode = nextMode => {
    setMode(nextMode);
    setError('');
    setNotice('');
    setAcceptedTerms(false);
    setResetStage('email');
    setForm(current => ({ ...current, password: '', code: '' }));
  };

  const chooseEmail = () => {
    setMethod('email');
    setError('');
    setNotice('');
  };

  const googleSignIn = async () => {
    setBusy(true);
    setError('');
    try {
      const idToken = await signInWithGoogle();
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not sign in with Google.');
      setUser(result.user);
      setOpen(false);
      const action = pendingAction.current;
      pendingAction.current = null;
      if (action) action();
      else router.push('/account');
    } catch (requestError) {
      const message = requestError.code === 'auth/unauthorized-domain'
        ? 'Add this website domain to Firebase Authentication’s authorized domains.'
        : requestError.code === 'auth/popup-closed-by-user'
          ? 'The Google sign-in window was closed before completing sign-in.'
          : requestError.message || 'Could not sign in with Google. Please try again.';
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, openLogin, requireAuth, logout, finishAccountDeletion, authError: error }}>
      {children}
      {open && <div className="auth-overlay" onMouseDown={event => {
        if (event.target === event.currentTarget && !busy) setOpen(false);
      }}>
        <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
          <button className="auth-close" type="button" aria-label="Close sign-in" onClick={() => setOpen(false)} disabled={busy}>×</button>
          <div className="auth-eyebrow">The Gifter’s Hub</div>
          {method === 'choose' ? <>
            <h2 id="auth-title">Sign in or create account</h2>
            <p className="auth-intro">Choose how you’d like to continue.</p>
            <div className="auth-methods">
              <button className="auth-method auth-google" type="button" onClick={googleSignIn} disabled={busy}>
                <span className="auth-google-mark" aria-hidden="true">G</span>
                Continue with Google
              </button>
              <button className="auth-method" type="button" onClick={chooseEmail}>
                <span aria-hidden="true">✉</span> Continue with email
              </button>
              <button className="auth-method" type="button" onClick={() => setError('Phone sign-in will be available after Firebase is set up.')}>
                <span aria-hidden="true">☎</span> Continue with phone <small>Coming soon</small>
              </button>
            </div>
            {error && <p className="auth-error" role="status">{error}</p>}
          </> : <>
            {mode === 'forgot'
              ? <button className="auth-back" type="button" onClick={() => { setMode('login'); setResetStage('email'); setError(''); setNotice(''); setForm(current => ({ ...current, password: '', code: '' })); }} disabled={busy}>← Back to sign in</button>
              : <button className="auth-back" type="button" onClick={() => { setMethod('choose'); setError(''); setNotice(''); }} disabled={busy}>← All sign-in options</button>}
            <h2 id="auth-title">{mode === 'register' ? 'Create your account' : mode === 'forgot' ? 'Reset your password' : 'Sign in with email'}</h2>
            <p className="auth-intro">{mode === 'register' ? 'Create an account to continue with your cart and checkout.' : mode === 'forgot' ? resetStage === 'email' ? 'Enter your account email and we’ll send a one-time reset code.' : 'Enter the 6-digit code from your email and choose a new password.' : 'Sign in to continue with your cart and checkout.'}</p>
            <form onSubmit={submit} className="auth-form">
              {mode === 'register' && <label>Your name
                <input required type="text" autoComplete="name" minLength={2} maxLength={100} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
              </label>}
              <label>Email address
                <input required type="email" autoComplete="email" maxLength={254} readOnly={mode === 'forgot' && resetStage === 'code'} value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} />
              </label>
              {mode === 'forgot' && resetStage === 'code' && <label>6-digit reset code
                <input required type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={form.code} onChange={event => setForm({ ...form, code: event.target.value.replace(/\D/g, '').slice(0, 6) })} />
              </label>}
              {(mode !== 'forgot' || resetStage === 'code') && <label>{mode === 'forgot' ? 'New password' : 'Password'}
                <input required type="password" autoComplete={mode === 'register' || mode === 'forgot' ? 'new-password' : 'current-password'} minLength={mode === 'login' ? 1 : 10} maxLength={128} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} />
                {(mode === 'register' || mode === 'forgot') && <small>Use at least 10 characters.</small>}
              </label>}
              {mode === 'login' && <button className="auth-forgot" type="button" onClick={() => { setMode('forgot'); setResetStage('email'); setError(''); setNotice(''); setForm(current => ({ ...current, password: '', code: '' })); }}>Forgot password?</button>}
              {mode === 'register' && <label className="auth-terms"><input required type="checkbox" checked={acceptedTerms} onChange={event => setAcceptedTerms(event.target.checked)} /><span>I agree to the <Link href="/terms" target="_blank">Terms &amp; Conditions</Link> and have read the <Link href="/privacy" target="_blank">Privacy Policy</Link>.</span></label>}
              {error && <p className="auth-error" role="alert">{error}</p>}
              {notice && <p className="auth-notice" role="status">{notice}</p>}
              <button className="btn alt auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'register' ? 'Create account' : mode === 'forgot' ? resetStage === 'email' ? 'Send reset code' : 'Reset password' : 'Continue'}</button>
            </form>
            {mode !== 'forgot' && <p className="auth-switch">
              {mode === 'register' ? 'Already have an account?' : 'New to The Gifter’s Hub?'}{' '}
              <button type="button" onClick={() => switchMode(mode === 'register' ? 'login' : 'register')} disabled={busy}>
                {mode === 'register' ? 'Sign in' : 'Create account'}
              </button>
            </p>}
          </>}
        </section>
      </div>}
    </AuthContext.Provider>
  );
}
