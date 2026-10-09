import { useEffect, useState } from 'react';
import { backendReachable } from './data/supabase';

// Phase 0 placeholder. Replaced by the router and screens in Phase 2.
export function App() {
  const [backend, setBackend] = useState<'checking' | 'connected' | 'offline'>('checking');

  useEffect(() => {
    backendReachable().then((ok) => setBackend(ok ? 'connected' : 'offline'));
  }, []);

  return (
    <main className="hello">
      <div className="card">
        <svg className="ring" viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r="52" className="ring-track" />
          <circle cx="60" cy="60" r="52" className="ring-fill" />
        </svg>
        <h1>Alignment</h1>
        <p className="muted">Hello. The app shell is live.</p>
        <p className="chip" data-state={backend}>
          Backend: {backend === 'checking' ? 'checking' : backend === 'connected' ? 'connected' : 'not reachable'}
        </p>
      </div>
    </main>
  );
}
