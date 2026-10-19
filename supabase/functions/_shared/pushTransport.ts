import webpush from 'npm:web-push@3.6.7';
import { validateEndpoint } from './homeownerPush.js';

export async function sendPush(subscription: unknown, payload: object, env: (name: string) => string) {
  const safe = validateEndpoint(subscription);
  // Generate RFC-compliant encrypted request with the pinned Node-compatible library;
  // use fetch ourselves so redirects cannot escape the push-service allowlist.
  const details = webpush.generateRequestDetails(safe, JSON.stringify(payload), {
    TTL: 21600, urgency: 'normal',
    vapidDetails: { subject: env('WEB_PUSH_VAPID_SUBJECT'), publicKey: env('WEB_PUSH_VAPID_PUBLIC_KEY'), privateKey: env('WEB_PUSH_VAPID_PRIVATE_KEY') },
  });
  return fetch(details.endpoint, { method: 'POST', headers: details.headers, body: new Uint8Array(details.body), redirect: 'error', signal: AbortSignal.timeout(10000) });
}
