// Web Push sending with VAPID. Expired subscriptions (404/410) are removed by the caller.
import webpush from 'npm:web-push@3.6.7';
import { env } from './http.ts';

let ready = false;
function init() {
  if (ready) return;
  webpush.setVapidDetails(env('VAPID_SUBJECT'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'));
  ready = true;
}

export interface Subscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

/** Returns 'ok', 'gone' (subscription expired, delete it) or an error message. */
export async function sendPush(sub: Subscription, payload: PushPayload): Promise<'ok' | 'gone' | string> {
  init();
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 600, urgency: 'high' });
    return 'ok';
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return 'gone';
    return `push failed (${status ?? 'network'}): ${(e as Error).message}`;
  }
}
