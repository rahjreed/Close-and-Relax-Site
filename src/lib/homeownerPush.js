import { pushStore } from './pushDeviceStore.js';
import { ensureHubWorker } from './pwa.js';

const apiUrl = () => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/homeowner-push-manage`;
const publicKey = () => import.meta.env.VITE_WEB_PUSH_VAPID_PUBLIC_KEY || '';
const apiKey = () => import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
export function pushSupport(browser = globalThis) {
  const nav = browser.navigator;
  const ios = /iphone|ipad|ipod/i.test(nav?.userAgent || '') || (nav?.platform === 'MacIntel' && nav?.maxTouchPoints > 1);
  const installed = browser.matchMedia?.('(display-mode: standalone)').matches || nav?.standalone === true;
  if (ios && !installed) return 'install-ios';
  if (!browser.isSecureContext || !nav?.serviceWorker || !browser.PushManager || !browser.Notification || !browser.indexedDB) return 'unsupported';
  return 'supported';
}
export function defaultReminderPreferences(now = new Date()) {
  const first = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', delivery_time: '10:00', reminders: [
    { kind: 'hvac', enabled: false, first_date: first, interval_days: 90 },
    { kind: 'monthly', enabled: false }, { kind: 'seasonal', enabled: false },
  ] };
}
function keyBytes(value) {
  return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4)), c => c.charCodeAt(0));
}
export async function managePush(record, action, extra = {}) {
  const response = await fetch(record.api_url, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: record.api_key },
    body: JSON.stringify({ id: record.id, token: record.token, action, ...extra }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Could not update reminders.');
  return result;
}
export async function loadReminderState(profileId, { preview = false } = {}) {
  if (preview || pushSupport() !== 'supported') return null;
  const record = await pushStore('installation');
  if (!record) return null;
  if (record.profile_id !== profileId) throw new Error('This installation belongs to a different hub. Turn off its reminders before enabling this hub.');
  if (record.unsubscribe_pending || Notification.permission !== 'granted') {
    await disableHomeReminders(profileId);
    return null;
  }
  const registration = await ensureHubWorker();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return { status: 'needs_subscription', preferences: record.preferences };
  let result;
  if (record.endpoint !== subscription.endpoint) {
    result = await managePush(record, 'replace', { profile_id: profileId, consent_version: 'home-reminders-v1', subscription: subscription.toJSON(), preferences: record.preferences });
    await pushStore('installation', { ...record, endpoint: subscription.endpoint }, 'write');
  } else result = await managePush(record, 'read');
  if (result.preferences) await pushStore('installation', { ...record, status: result.status, preferences: result.preferences, endpoint: subscription.endpoint }, 'write');
  return result;
}
export async function enableHomeReminders(profileId, preferences, { preview = false } = {}) {
  if (preview) throw new Error('Reminders are disabled in private preview.');
  if (pushSupport() !== 'supported') throw new Error('Push reminders are unavailable in this browser context.');
  if (!publicKey()) throw new Error('Home reminders are not available yet.');
  // This must run directly from the homeowner's click, before any asynchronous work.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications are blocked. You can change this in your browser or app notification settings.');
  const registration = await ensureHubWorker();
  if (!registration) throw new Error('Open your published Realtor hub to enable reminders.');
  let record = await pushStore('installation');
  if (record && record.profile_id !== profileId) throw new Error('Turn off reminders for the previous hub first.');
  const previous = record;
  if (!record) record = { id: crypto.randomUUID(), token: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', ''), profile_id: profileId, api_url: apiUrl(), api_key: apiKey() };
  let subscription = await registration.pushManager.getSubscription();
  if (!previous && subscription) { await subscription.unsubscribe(); subscription = null; }
  if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey()) });
  const action = previous?.status === 'active' && previous.endpoint === subscription.endpoint ? 'preferences' : previous ? 'replace' : 'enroll';
  record = { ...record, preferences, endpoint: subscription.endpoint, unsubscribe_pending: false, status: action === 'preferences' ? 'active' : 'pending' };
  // Save before enrollment so a confirmation arriving immediately can access the capability.
  await pushStore('installation', record, 'write');
  try {
    const result = await managePush(record, action, { profile_id: profileId, preferences, subscription: subscription.toJSON(), consent_version: 'home-reminders-v1' });
    // Avoid overwriting an immediate confirmation received by the service worker.
    if (result.status === 'active') await pushStore('installation', { ...record, status: 'active' }, 'write');
    const latest = await pushStore('installation');
    if (latest?.id === record.id && latest.status === 'active') return { ...result, status: 'active' };
    // A prior failed enrollment has a saved local record but no active server row.
    return result;
  } catch (error) {
    if (action === 'preferences') {
      return managePush(record, 'enroll', { profile_id: profileId, preferences, subscription: subscription.toJSON(), consent_version: 'home-reminders-v1' });
    }
    throw error;
  }
}
export async function disableHomeReminders(profileId, { preview = false } = {}) {
  if (preview) return;
  const record = await pushStore('installation');
  if (record && record.profile_id !== profileId) throw new Error('This installation belongs to a different hub.');
  // Browser unsubscribe is immediate even if the server is offline. Keep a pending
  // revocation credential until a later foreground request can remove server data.
  if (record) await pushStore('installation', { ...record, unsubscribe_pending: true }, 'write');
  const registration = await navigator.serviceWorker?.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) await subscription.unsubscribe();
  if (record) {
    await managePush(record, 'unsubscribe');
    await pushStore('installation', null, 'delete');
  }
}
