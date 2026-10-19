export const PUSH_DB = 'closeandrelax-push-v1';
export const PUSH_STORE = 'settings';
export function openPushStore() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error('Private browser storage is unavailable.'));
    const request = indexedDB.open(PUSH_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(PUSH_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Private browser storage is unavailable.'));
  });
}
export async function pushStore(key, value, mode = 'read') {
  const db = await openPushStore();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PUSH_STORE, mode === 'read' ? 'readonly' : 'readwrite');
    const store = transaction.objectStore(PUSH_STORE);
    const request = mode === 'read' ? store.get(key) : mode === 'delete' ? store.delete(key) : store.put(value, key);
    transaction.oncomplete = () => { db.close(); resolve(request.result); };
    transaction.onerror = transaction.onabort = () => { db.close(); reject(new Error('Could not save reminder settings.')); };
  });
}
