import { useState } from 'react';
import { supabase } from '../data/supabase';

/**
 * Email sign-in. The email has a link and a 6 digit code. On iPhone the Home Screen app cannot open the
 * link inside itself, so the code is the reliable path there.
 */
export function Login() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin, shouldCreateUser: true },
    });
    setBusy(false);
    if (error) setError(signupClosed(error.message) ? 'This app is closed to new accounts. Use the email you signed up with.' : `Could not send the email. ${error.message}`);
    else setSent(true);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setError('That code did not work. Check the newest email and try again.');
  }

  return (
    <main className="fullscreen">
      <div className="stack">
        <h1 className="big">Alignment</h1>
        <p className="muted">Sign in with your email.</p>
      </div>
      {!sent ? (
        <form className="card pad stack lg" onSubmit={send}>
          <label className="label">
            Email
            <input className="field" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button className="btn primary block" disabled={busy}>
            {busy ? 'Sending' : 'Email me a sign-in code'}
          </button>
        </form>
      ) : (
        <form className="card pad stack lg" onSubmit={verify}>
          <p>Check {email}. Type the code from the email here, or tap the link in it.</p>
          <label className="label">
            Code
            <input
              className="field"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={10}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <button className="btn primary block" disabled={busy || code.trim().length < 6}>
            {busy ? 'Checking' : 'Sign in'}
          </button>
          <button type="button" className="btn ghost" onClick={() => setSent(false)}>
            Use a different email
          </button>
        </form>
      )}
      {error && (
        <p className="banner warn" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}

const signupClosed = (m: string) => /signups? not allowed|disabled/i.test(m);
