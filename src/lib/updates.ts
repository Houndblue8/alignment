// Keep the installed app current. An iPhone home-screen app often resumes instead of relaunching, so it
// can keep running an old copy for days. Check for a new version on launch, whenever the app comes back to
// the front, and every 30 minutes; when one is ready, reload once (at most every 10 seconds).
import { registerSW } from 'virtual:pwa-register';

export function keepUpdated(): void {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  let reg: ServiceWorkerRegistration | undefined;
  const check = () => void reg?.update().catch(() => undefined);
  registerSW({
    immediate: true,
    onRegisteredSW(_url, r) {
      reg = r;
      setInterval(check, 30 * 60_000);
    },
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  // The new worker takes over right away (skipWaiting and clientsClaim in sw.ts); reload onto its files.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const last = Number(sessionStorage.getItem('alignment.reloadedAt') ?? 0);
    if (Date.now() - last < 10_000) return;
    sessionStorage.setItem('alignment.reloadedAt', String(Date.now()));
    window.location.reload();
  });
}
