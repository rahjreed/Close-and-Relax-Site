export const base64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
export const decode64 = (value) => Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4)), c => c.charCodeAt(0));
export const randomToken = () => base64url(crypto.getRandomValues(new Uint8Array(32)));
export async function hash(value) { return base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))); }
export async function encryptSubscription(value, secret) {
  const raw = decode64(secret);
  if (raw.length !== 32) throw new Error('Invalid encryption configuration.');
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(value)));
  return `${base64url(iv)}.${base64url(data)}`;
}
export async function decryptSubscription(value, secret) {
  const [iv, data] = value.split('.');
  const key = await crypto.subtle.importKey('raw', decode64(secret), 'AES-GCM', false, ['decrypt']);
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode64(iv) }, key, decode64(data))));
}
export async function secureEqual(a, b) {
  // Fixed-size digest comparison also avoids length-dependent secret comparisons.
  const x = await hash(a), y = await hash(b);
  let diff = 0; for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}
