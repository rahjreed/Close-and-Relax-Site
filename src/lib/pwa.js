import { pushStore } from './pushDeviceStore.js';
export function isHubOrigin(location = globalThis.location) {
  return location?.protocol === 'https:' && /^[a-z0-9-]+\.closeandrelax\.com$/.test(location.hostname) &&
    !['www', 'app', 'api'].includes(location.hostname.split('.')[0]);
}
export async function ensureHubWorker({ preview = false } = {}) {
  if (preview || !isHubOrigin() || !globalThis.navigator?.serviceWorker) return null;
  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
  // Wait for an active worker before subscribing; no notification permission here.
  await navigator.serviceWorker.ready;
  if (!navigator.serviceWorker.controller) {
    await new Promise(resolve => {
      let timeout;
      const done = () => { clearTimeout(timeout); navigator.serviceWorker.removeEventListener('controllerchange', done); resolve(); };
      navigator.serviceWorker.addEventListener('controllerchange', done, { once: true });
      timeout = setTimeout(done, 3000);
      if (navigator.serviceWorker.controller) done();
    });
  }
  return registration;
}
export async function saveHubManifest(manifest, { preview = false } = {}) {
  if (preview || !isHubOrigin()) return;
  await pushStore('manifest', { ...manifest, id: '/', start_url: '/', scope: '/' }, 'write');
  await ensureHubWorker({ preview });
}
