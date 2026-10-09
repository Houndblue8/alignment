// Turning on Web Push for this device. Permission is only asked after Eli taps Enable.
export const VAPID_PUBLIC_KEY = 'BKE2qbzEpYPyaS1S9DyvXY3n1fHjT8_lxWkEWkX71FCsrNoMm5n0i2aDkNgsYby-_Luo_ct9rG7z1e3eUJd8RFk';

export type PushState = 'unsupported' | 'needs-install' | 'blocked' | 'off' | 'on';

const isIos = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);
const standalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function deviceLabel(): string {
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return 'Android';
  if (/Mac/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows';
  return 'This device';
}

export async function pushState(): Promise<PushState> {
  if (isIos() && !standalone()) return 'needs-install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Ask permission and subscribe. Returns the subscription details to save, or a plain reason it did not work. */
export async function enablePush(): Promise<{ endpoint: string; keys: { p256dh: string; auth: string } } | string> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'Notifications were not allowed. Reminders will show inside the app while it is open.';
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  return { endpoint: json.endpoint, keys: json.keys };
}

export async function disablePush(): Promise<string | null> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  return endpoint;
}
