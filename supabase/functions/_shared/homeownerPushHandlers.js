import { hubOrigin, validateEndpoint, validatePreferences, failureDisposition, notificationBody, CONSENT_VERSION, CLICK_PATH } from './homeownerPush.js';
import { hash, randomToken, encryptSubscription, decryptSubscription, secureEqual } from './pushCrypto.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const capability = /^[A-Za-z0-9_-]{43}$/;
const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'WEB_PUSH_VAPID_PUBLIC_KEY', 'WEB_PUSH_VAPID_PRIVATE_KEY', 'WEB_PUSH_VAPID_SUBJECT', 'WEB_PUSH_SUBSCRIPTION_ENCRYPTION_KEY'];
const checked = async (promise) => { const { data, error } = await promise; if (error) throw new Error('Request unavailable.'); return data; };
const json = (status, body, origin = '') => new Response(JSON.stringify(body), { status, headers: {
  'Content-Type': 'application/json', 'Cache-Control': 'no-store',
  ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info' } : {}),
} });

export function createManageHandler({ client, send, env }) {
  return async (request) => {
    let origin;
    try { origin = hubOrigin(request.headers.get('origin') || ''); } catch { return json(403, { error: 'Open your published hub.' }); }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: json(200, {}, origin).headers });
    if (request.method !== 'POST') return json(405, { error: 'Use POST.' }, origin);
    if (!required.every(name => env(name))) return json(503, { error: 'Reminders are not available yet.' }, origin);
    try {
      if (Number(request.headers.get('content-length') || 0) > 16384) return json(413, { error: 'Request too large.' }, origin);
      const text = await request.text(); if (text.length > 16384) return json(413, { error: 'Request too large.' }, origin);
      const input = JSON.parse(text);
      if (!uuid.test(input.id || '') || !capability.test(input.token || '') ||
          !['enroll', 'confirm', 'read', 'preferences', 'replace', 'unsubscribe'].includes(input.action))
        return json(400, { error: 'Invalid reminder request.' }, origin);
      const api = client();
      // Per-installation + shared origin limits cannot be bypassed by rotating claimed IPs.
      // IP is transient, salted before storage, and never logged or associated with analytics.
      const salt = env('WEB_PUSH_SUBSCRIPTION_ENCRYPTION_KEY');
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
      for (const [key, maximum] of [[`installation:${input.id}`, 60], [`network:${ip}`, 120],
        ...(input.action === 'enroll' ? [[`enrollment:${origin}`, 120]] : [])]) {
        if (!await checked(api.rpc('homeowner_push_rate_limit', { bucket: await hash(`${salt}:push-rate:${key}`), maximum })))
          return json(429, { error: 'Please wait before trying again.' }, origin);
      }
      const payload = { action: input.action, id: input.id, origin, capability_hash: await hash(input.token) };
      let subscription, confirmation;
      if (['enroll', 'replace', 'preferences'].includes(input.action)) payload.preferences = validatePreferences(input.preferences);
      if (['enroll', 'replace'].includes(input.action)) {
        if (!uuid.test(input.profile_id || '') || input.consent_version !== CONSENT_VERSION)
          return json(400, { error: 'Confirm reminder consent.' }, origin);
        subscription = validateEndpoint(input.subscription);
        confirmation = randomToken();
        Object.assign(payload, { profile_id: input.profile_id, endpoint_hash: await hash(subscription.endpoint),
          encrypted_subscription: await encryptSubscription(subscription, salt), confirmation_hash: await hash(confirmation),
          vapid_key_id: await hash(env('WEB_PUSH_VAPID_PUBLIC_KEY')) });
      }
      if (input.action === 'confirm') {
        if (!capability.test(input.confirmation || '')) return json(400, { error: 'Invalid confirmation.' }, origin);
        payload.confirmation_hash = await hash(input.confirmation);
      }
      const result = await checked(api.rpc('homeowner_push_manage', { payload }));
      if (subscription) {
        // A visible, one-time confirmation push proves this browser possesses the subscription.
        // It is not a silent synchronization channel. Recurring delivery stays pending until confirmed.
        const sent = await send(subscription, { title: 'Close & Relax', body: 'Home reminders are enabled on this browser.',
          path: CLICK_PATH, tag: `home-reminders-confirm-${input.id}`, confirmation, installation_id: input.id }, env);
        if (!sent.ok) return json(503, { error: 'Could not confirm notifications. Please try again.' }, origin);
      }
      return json(200, result, origin);
    } catch {
      // Never return or log endpoints, capabilities, raw upstream errors, or homeowner data.
      return json(400, { error: 'Unable to update reminders. Reopen your published hub and try again.' }, origin);
    }
  };
}

export function createDispatchHandler({ client, send, env, now = Date.now }) {
  return async (request) => {
    const secret = env('WEB_PUSH_CRON_SECRET');
    if (!secret || !await secureEqual(request.headers.get('x-push-cron-secret') || '', secret)) return json(403, { error: 'Forbidden.' });
    if (request.method !== 'POST') return json(405, { error: 'Use POST.' });
    if (!required.every(name => env(name))) return json(503, { error: 'Push configuration incomplete.' });
    const api = client();
    try {
      const started = now();
      const summary = { claimed: 0, accepted: 0, failed: 0, auth_errors: 0 };
      const deliver = async (item) => {
        if (!await checked(api.rpc('homeowner_push_send_allowed', { delivery_id: item.id, lease: item.lease_token }))) return;
        let state = 'failed', retry = null, code = 'configuration';
        try {
          if (item.vapid_key_id !== await hash(env('WEB_PUSH_VAPID_PUBLIC_KEY'))) {
            state = 'auth_error'; code = 'vapid_key_changed';
          } else {
            const subscription = await decryptSubscription(item.encrypted_subscription, env('WEB_PUSH_SUBSCRIPTION_ENCRYPTION_KEY'));
            let response;
            try {
              response = await send(subscription, { title: 'Close & Relax', body: notificationBody(item.kinds, item.local_month),
                path: CLICK_PATH, tag: `home-reminder-${item.id}` }, env);
            } catch { response = { ok: false, status: 0, headers: new Headers() }; }
            code = `http_${response.status}`;
            if (response.ok) state = 'accepted';
            else {
              const disposition = failureDisposition(response.status, item.attempt, response.headers.get('retry-after'), now());
              state = disposition.state;
              if (state === 'retry') retry = new Date(now() + disposition.delay).toISOString();
            }
          }
        } catch { state = 'auth_error'; code = 'decrypt_or_config'; }
        await checked(api.rpc('homeowner_push_finish', { delivery_id: item.id, lease: item.lease_token, outcome: state, retry_at: retry, error_code: state === 'accepted' ? null : code }));
        if (state === 'accepted') summary.accepted++; else summary.failed++;
        if (state === 'auth_error') summary.auth_errors++;
      };
      // Drain bounded batches with five concurrent sends, leaving room within the
      // Edge runtime deadline. Durable leases recover any interrupted invocation.
      while (now() - started < 60000 && summary.claimed < 500 && !summary.auth_errors) {
        const work = await checked(api.rpc('homeowner_push_claim'));
        if (!work.length) break;
        summary.claimed += work.length;
        for (let offset = 0; offset < work.length; offset += 5) {
          await Promise.all(work.slice(offset, offset + 5).map(deliver));
          if (summary.auth_errors) break;
        }
      }
      // Operational counts only; push acceptance is not proof of device receipt.
      return json(summary.auth_errors ? 503 : 200, summary);
    } catch { return json(503, { error: 'Dispatcher unavailable.' }); }
  };
}
