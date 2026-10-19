/* Push-only worker. No app-shell, Auth, Insurance Leads, or homeowner data caching. */
const DB = 'closeandrelax-push-v1';
async function stored(key, value) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('settings');
    request.onerror = () => reject(new Error('Storage unavailable'));
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('settings', value === undefined ? 'readonly' : 'readwrite');
      const op = value === undefined ? tx.objectStore('settings').get(key) : tx.objectStore('settings').put(value, key);
      tx.oncomplete = () => { db.close(); resolve(op.result); };
      tx.onerror = tx.onabort = () => { db.close(); reject(new Error('Storage unavailable')); };
    };
  });
}
function notificationTarget(value, origin = self.location.origin) {
  // No client-provided URLs, profile IDs, arbitrary paths, credentials, or external destinations.
  return new URL(value === '/#homeowner-checklist' ? value : '/#home-reminders', origin).href;
}
async function management(record, action, extra = {}) {
  // Only use the configured Supabase project HTTPS endpoint, never a payload destination.
  const url = new URL(record.api_url);
  if (url.protocol !== 'https:' || !/^[a-z0-9]+\.supabase\.co$/.test(url.hostname) || url.port ||
      url.pathname !== '/functions/v1/homeowner-push-manage' || url.search || url.hash) throw new Error('Invalid endpoint');
  const response = await fetch(url.href, { method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json', apikey: record.api_key },
    body: JSON.stringify({ id: record.id, token: record.token, action, ...extra }) });
  if (!response.ok) throw new Error('Management unavailable');
  return response.json();
}
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname !== '/manifest.webmanifest' || event.request.method !== 'GET') return;
  event.respondWith((async () => {
    const manifest = await stored('manifest').catch(() => null);
    if (!manifest) return fetch(event.request);
    return new Response(JSON.stringify({ ...manifest, id: '/', start_url: '/', scope: '/' }), { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'no-cache' } });
  })());
});
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let data = {}; try { data = event.data?.json() || {}; } catch { /* generic visible fallback */ }
    const approved = [
      'Home reminders are enabled on this browser.', 'Time to check your HVAC filter.',
      'Your monthly home-maintenance check-in is ready.', 'Fall maintenance: check gutters and outdoor faucets.',
      'Your seasonal home-maintenance check-in is ready.', 'Your home reminders are ready. Open your hub for a maintenance check-in.',
    ];
    await self.registration.showNotification('Close & Relax', {
      body: approved.includes(data.body) ? data.body : 'Your home reminders are ready.',
      icon: '/icons/home-reminders-192.png', badge: '/icons/home-reminders-192.png',
      tag: /^home-reminder[s]?-[-a-z0-9]{1,100}$/.test(data.tag || '') ? data.tag : 'home-reminders',
      data: { path: notificationTarget(data.path) },
    });
    if (data.confirmation && data.installation_id) {
      const record = await stored('installation').catch(() => null);
      if (record && record.id === data.installation_id && !record.unsubscribe_pending && /^[A-Za-z0-9_-]{43}$/.test(data.confirmation)) {
        try {
          const result = await management(record, 'confirm', { confirmation: data.confirmation });
          await stored('installation', { ...record, status: result.status });
          const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
          for (const client of windows) client.postMessage({ type: 'home-reminders-confirmed' });
        } catch { /* Remains pending. Foreground retry can resend visible confirmation. */ }
      }
    }
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const raw = event.notification.data?.path;
    // Data is an absolute same-origin URL only after our own normalization above.
    const target = notificationTarget(raw === `${self.location.origin}/#homeowner-checklist` ? '/#homeowner-checklist' : null);
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => { const url = new URL(client.url); return url.origin === self.location.origin && url.pathname === '/'; });
    if (existing) { await existing.navigate(target); await existing.focus(); }
    else await self.clients.openWindow(target);
  })());
});
self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil((async () => {
    const record = await stored('installation').catch(() => null);
    if (!record || record.unsubscribe_pending) return;
    try {
      const subscription = event.newSubscription || await self.registration.pushManager.getSubscription();
      if (!subscription) return; // Reconcile interactively on next hub open; never request permission here.
      const result = await management(record, 'replace', { profile_id: record.profile_id, preferences: record.preferences,
        consent_version: 'home-reminders-v1', subscription: subscription.toJSON() });
      await stored('installation', { ...record, endpoint: subscription.endpoint, status: result.status });
    } catch { /* Foreground reconciliation is the reliable fallback. */ }
  })());
});
