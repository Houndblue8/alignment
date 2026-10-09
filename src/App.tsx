import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { DATA_MODE } from './data/repo';
import { supabase } from './data/supabase';
import { nowLocal } from './lib/clock';
import { CheckIn } from './screens/CheckIn';
import { Contract } from './screens/Contract';
import { Home } from './screens/Home';
import { Login } from './screens/Login';
import { Quotes } from './screens/Quotes';
import { Settings } from './screens/Settings';
import { Today } from './screens/Today';
import { Vision } from './screens/Vision';
import { DayDetail, Week } from './screens/Week';
import { dayOf } from './state/planning';
import { useApp } from './state/store';
import { Nav } from './ui/Nav';
import { ToastView } from './ui/Toast';

export function App() {
  return (
    <BrowserRouter>
      {DATA_MODE === 'local' ? <Loaded /> : <AuthGate />}
      <ToastView />
    </BrowserRouter>
  );
}

function AuthGate() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  if (session === undefined) return <Splash />;
  if (!session) return <Login />;
  return <Loaded key={session.user.id} />;
}

function Splash() {
  return (
    <main className="fullscreen" aria-busy="true">
      <h1 className="big">Alignment</h1>
    </main>
  );
}

function Loaded() {
  const status = useApp((a) => a.status);
  const error = useApp((a) => a.error);
  const s = useApp((a) => a.s);
  const now = useApp((a) => a.now);
  const init = useApp((a) => a.init);
  const tick = useApp((a) => a.tick);

  useEffect(() => {
    void init();
  }, [init]);

  // Keep the clock fresh; a new calendar day reloads (scores yesterday, shows the check-in).
  useEffect(() => {
    const id = setInterval(() => {
      const date = useApp.getState().now.date;
      if (nowLocal().date !== date) void init();
      else tick();
    }, 30_000);
    const onVisible = () => document.visibilityState === 'visible' && (nowLocal().date !== useApp.getState().now.date ? init() : tick());
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [init, tick]);

  if (status === 'loading' || !s) {
    if (status === 'error') return <ErrorView message={error} retry={init} />;
    return <Splash />;
  }
  if (status === 'error') return <ErrorView message={error} retry={init} />;
  if (!s.contract.signedName) return <Contract />;
  if (!dayOf(s, now.date).checkinDone) return <CheckIn />;

  return (
    <div className="shell with-nav">
      <Nav />
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/today" element={<Today />} />
          <Route path="/week" element={<Week />} />
          <Route path="/week/:date" element={<DayDetail />} />
          <Route path="/quotes" element={<Quotes />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/vision" element={<Vision />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function ErrorView({ message, retry }: { message: string | null; retry: () => void }) {
  return (
    <main className="fullscreen">
      <h1 className="big">Alignment</h1>
      <p className="banner warn" role="alert">
        {message ?? 'Something went wrong.'}
      </p>
      <button className="btn primary block" onClick={retry}>
        Try again
      </button>
    </main>
  );
}
