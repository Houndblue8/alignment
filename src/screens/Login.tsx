import { useState } from 'react';
import { supabase } from '../data/supabase';

type Mode = 'signIn' | 'create' | 'forgot';

/** Email and password sign-in (DECISIONS D9). Works the same in the iPhone Home Screen app and in a browser. */
export function Login() {
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const addr = email.trim();
    if (mode === 'signIn') {
      const { error } = await supabase.auth.signInWithPassword({ email: addr, password });
      if (error) setError(/invalid/i.test(error.message) ? 'That email and password do not match.' : `Could not sign in. ${error.message}`);
    } else if (mode === 'create') {
      const { data, error } = await supabase.auth.signUp({ email: addr, password });
      if (error) setError(/not allowed|disabled/i.test(error.message) ? 'This app is closed to new accounts.' : `Could not create the account. ${error.message}`);
      else if (!data.session) setInfo('Account created. Check your email to confirm it, then sign in here.');
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(addr, { redirectTo: window.location.origin });
      if (error) setError(`Could not send the reset email. ${error.message}`);
      else setInfo('Reset email sent. Open the link, set a new password, then sign in here.');
    }
    setBusy(false);
  }

  const label = mode === 'signIn' ? 'Sign in' : mode === 'create' ? 'Create account' : 'Email me a reset link';

  return (
    <main className="fullscreen">
      <div className="stack">
        <h1 className="big">Alignment</h1>
        <p className="muted">{mode === 'create' ? 'Create your account.' : mode === 'forgot' ? 'Reset your password.' : 'Sign in.'}</p>
      </div>
      <form className="card pad stack lg" onSubmit={submit}>
        <label className="label">
          Email
          <input className="field" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {mode !== 'forgot' && (
          <label className="label">
            Password
            <input
              className="field"
              type="password"
              autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}
        <button className="btn primary block" disabled={busy}>
          {busy ? 'One moment' : label}
        </button>
      </form>
      {error && (
        <p className="banner warn" role="alert">
          {error}
        </p>
      )}
      {info && (
        <p className="banner" role="status">
          {info}
        </p>
      )}
      <div className="row wrap">
        {mode !== 'signIn' && (
          <button className="btn ghost" onClick={() => setMode('signIn')}>
            Back to sign in
          </button>
        )}
        {mode === 'signIn' && (
          <>
            <button className="btn ghost" onClick={() => setMode('forgot')}>
              Forgot password
            </button>
            <button className="btn ghost" onClick={() => setMode('create')}>
              First time? Create account
            </button>
          </>
        )}
      </div>
    </main>
  );
}

/** Shown after opening a password reset link. */
export function SetPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <main className="fullscreen">
      <h1 className="big">New password</h1>
      <form
        className="card pad stack lg"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const { error } = await supabase.auth.updateUser({ password });
          setBusy(false);
          if (error) setError(`Could not save it. ${error.message}`);
          else onDone();
        }}
      >
        <label className="label">
          New password (8 or more characters)
          <input className="field" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button className="btn primary block" disabled={busy}>
          Save password
        </button>
      </form>
      {error && (
        <p className="banner warn" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
