import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { validateGooseheadLead } from '../_shared/gooseheadLead.js';

const env = (name: string) => Deno.env.get(name) || '';
const allowedOrigin = (origin: string) => {
  try {
    const url = new URL(origin);
    return (
      (url.protocol === 'https:' &&
        (url.hostname === 'closeandrelax.com' || url.hostname.endsWith('.closeandrelax.com'))) ||
      env('GOOSEHEAD_ALLOWED_ORIGINS')
        .split(',')
        .map((s) => s.trim())
        .includes(origin)
    );
  } catch {
    return false;
  }
};
const reply = (status: number, body: object, origin = '') =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...(allowedOrigin(origin)
        ? {
            'Access-Control-Allow-Origin': origin,
            Vary: 'Origin',
            'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
          }
        : {}),
    },
  });
Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin') || '';
  if (request.method === 'OPTIONS')
    return allowedOrigin(origin)
      ? new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
            Vary: 'Origin',
          },
        })
      : reply(403, { error: 'Request unavailable.' });
  if (request.method !== 'POST') return reply(405, { error: 'Use POST.' }, origin);
  if (!allowedOrigin(origin)) return reply(403, { error: 'Request unavailable.' });
  if (
    ![
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'TURNSTILE_SECRET_KEY',
      'GOOSEHEAD_RATE_LIMIT_SALT',
    ].every((name) => env(name))
  )
    return reply(
      503,
      { error: 'The request form is temporarily unavailable. Please try again later.' },
      origin,
    );
  const client = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });
  try {
    if (Number(request.headers.get('content-length') || 0) > 16384)
      return reply(413, { error: 'Request too large.' }, origin);
    const raw = await request.text();
    if (raw.length > 16384) return reply(413, { error: 'Request too large.' }, origin);
    const input = JSON.parse(raw);
    if (input.company_website) return reply(400, { error: 'Request unavailable.' }, origin);
    let lead;
    try {
      lead = validateGooseheadLead(input);
    } catch (error) {
      return reply(
        400,
        { error: error instanceof Error ? error.message : 'Check your request details.' },
        origin,
      );
    }
    if (typeof input.captcha_token !== 'string' || !input.captcha_token)
      return reply(400, { error: 'Complete the verification before submitting.' }, origin);
    const captcha = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({
        secret: env('TURNSTILE_SECRET_KEY'),
        response: input.captcha_token,
      }),
      signal: AbortSignal.timeout(10000),
    }).then((response) => response.json());
    if (
      !captcha.success ||
      captcha.action !== 'goosehead_lead' ||
      !allowedOrigin(`https://${captcha.hostname}`) ||
      captcha.hostname !== new URL(origin).hostname
    )
      return reply(400, { error: 'Verification expired. Please try again.' }, origin);
    const ip =
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0].trim();
    if (!ip) return reply(503, { error: 'Request unavailable. Please try again later.' }, origin);
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(env('GOOSEHEAD_RATE_LIMIT_SALT')),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ip));
    const hash = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('');
    const { error } = await client.rpc('submit_goosehead_homeowner_lead', {
      lead,
      client_hash: hash,
    });
    if (error)
      return reply(
        error.message.includes('Too many') ? 429 : 400,
        {
          error: error.message.includes('Too many')
            ? 'Too many requests. Please try again later.'
            : 'This request could not be saved. Check your details and try again.',
        },
        origin,
      );
    return reply(202, { accepted: true }, origin);
  } catch {
    return reply(503, { error: 'Unable to submit right now. Please try again.' }, origin);
  }
});
