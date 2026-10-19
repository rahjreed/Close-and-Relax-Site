// Shared, side-effect-free validation. No homeowner identity or checklist data.
export const REMINDER_TYPES = ['hvac', 'monthly', 'seasonal'];
export const CONSENT_VERSION = 'home-reminders-v1';
export const CLICK_PATH = '/#homeowner-checklist';
export function hubOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.port || url.username || url.password ||
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.closeandrelax\.com$/.test(url.hostname) ||
      ['www', 'api', 'app'].includes(url.hostname.split('.')[0]) || url.origin !== value) {
    throw new Error('Open reminders from your published Realtor hub.');
  }
  return url.origin;
}
export function validateEndpoint(subscription) {
  if (!subscription || typeof subscription.endpoint !== 'string' || subscription.endpoint.length > 2048)
    throw new Error('Invalid subscription.');
  const url = new URL(subscription.endpoint);
  const supported =
    (url.hostname === 'fcm.googleapis.com' && url.pathname.startsWith('/fcm/send/')) ||
    (url.hostname === 'updates.push.services.mozilla.com' && url.pathname.startsWith('/wpush/v2/')) ||
    (/^(?:[a-z0-9-]+\.)*push\.apple\.com$/.test(url.hostname) && url.pathname.length > 1);
  if (!supported || url.protocol !== 'https:' || url.port || url.username || url.password || url.hash || url.search)
    throw new Error('Unsupported push service.');
  if (!/^[A-Za-z0-9_-]{87}$/.test(subscription.keys?.p256dh || '') ||
      !/^[A-Za-z0-9_-]{22}$/.test(subscription.keys?.auth || '')) throw new Error('Invalid subscription keys.');
  return { endpoint: url.href, keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth } };
}
export function validatePreferences(input) {
  if (!input || typeof input !== 'object') throw new Error('Choose reminder settings.');
  try { new Intl.DateTimeFormat('en-US', { timeZone: input.timezone }).format(); }
  catch { throw new Error('Choose a valid timezone.'); }
  if (typeof input.timezone !== 'string' || input.timezone.length > 100 || !/^\d{2}:\d{2}$/.test(input.delivery_time) ||
      input.delivery_time < '09:00' || input.delivery_time > '19:00') throw new Error('Choose a delivery time from 9 a.m. to 7 p.m.');
  const reminders = REMINDER_TYPES.map((kind) => {
    const found = input.reminders?.find((r) => r.kind === kind);
    if (!found || typeof found.enabled !== 'boolean') throw new Error('Choose all reminder preferences.');
    const result = { kind, enabled: found.enabled };
    if (kind === 'hvac' && found.enabled) {
      const date = String(found.first_date || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date ||
          !Number.isInteger(found.interval_days) || found.interval_days < 7 || found.interval_days > 730)
        throw new Error('Choose an HVAC date and an interval of 7–730 days.');
      result.first_date = date; result.interval_days = found.interval_days;
    }
    return result;
  });
  if (input.reminders?.length !== 3 || new Set(input.reminders.map(r => r.kind)).size !== 3)
    throw new Error('Unsupported reminder type.');
  return { timezone: input.timezone, delivery_time: input.delivery_time, reminders };
}
export function failureDisposition(status, attempt, retryAfter, now = Date.now(), random = Math.random) {
  if ([404, 410].includes(status)) return { state: 'invalid', delay: 0 };
  if ([401, 403].includes(status)) return { state: 'auth_error', delay: 0 };
  if ((status === 0 || status === 429 || status >= 500) && attempt < 5) {
    const seconds = Number(retryAfter);
    const headerDelay = retryAfter ? (Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - now) : 0;
    return { state: 'retry', delay: Math.max(60000 * 2 ** (attempt - 1) + random() * 30000, headerDelay || 0) };
  }
  return { state: 'failed', delay: 0 };
}
export function notificationBody(kinds, localMonth) {
  if (kinds.length > 1) return 'Your home reminders are ready. Open your hub for a maintenance check-in.';
  if (kinds[0] === 'hvac') return 'Time to check your HVAC filter.';
  if (kinds[0] === 'monthly') return 'Your monthly home-maintenance check-in is ready.';
  if ([9, 10, 11].includes(localMonth)) return 'Fall maintenance: check gutters and outdoor faucets.';
  return 'Your seasonal home-maintenance check-in is ready.';
}
