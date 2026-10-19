import { sendPush } from '../supabase/functions/_shared/pushTransport.ts';

Deno.test('pinned Web Push transport encrypts/signs under Deno without a network send or redirects', async () => {
  // Public mathematical P-256 generator/scalar-one fixtures. These are not generated
  // keys, production credentials, or a configured VAPID identity.
  const point = '046b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2964fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5';
  const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
  const publicPoint = b64(Uint8Array.from(point.match(/../g)!.map(v => parseInt(v,16))));
  const scalarOne = b64(Uint8Array.from([...Array(31).fill(0),1]));
  const env = (name: string) => ({ WEB_PUSH_VAPID_PUBLIC_KEY: publicPoint, WEB_PUSH_VAPID_PRIVATE_KEY: scalarOne, WEB_PUSH_VAPID_SUBJECT: 'mailto:push-tests@example.invalid' })[name] || '';
  const original = globalThis.fetch;let calls = 0;
  globalThis.fetch = async (input, options) => {
    calls++;
    if (String(input) !== 'https://fcm.googleapis.com/fcm/send/test-fixture') throw new Error('wrong destination');
    if (options?.redirect !== 'error' || !(options.body instanceof Uint8Array)) throw new Error('unsafe request');
    const headers = new Headers(options.headers);
    if (headers.get('content-encoding') !== 'aes128gcm' || !headers.get('authorization')?.startsWith('vapid ')) throw new Error('encryption/signing unavailable');
    if (headers.get('ttl') !== '21600') throw new Error('wrong expiry');
    return new Response('', { status:201 });
  };
  try {
    const response = await sendPush({endpoint:'https://fcm.googleapis.com/fcm/send/test-fixture',keys:{p256dh:publicPoint,auth:b64(new Uint8Array(16))}}, {title:'Close & Relax',body:'Time to check your HVAC filter.'},env);
    if (response.status !== 201 || calls !== 1) throw new Error('request generation failed');
  } finally { globalThis.fetch = original; }
});
