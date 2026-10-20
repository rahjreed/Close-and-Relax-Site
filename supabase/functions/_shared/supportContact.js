export function validateSupportContact(input) {
  const text = (key, max) => {
    if (typeof input?.[key] !== 'string') throw new Error('Check your contact details.');
    const value = input[key].trim();
    if (!value || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))
      throw new Error('Check your contact details.');
    return value;
  };
  const request_id = text('request_id', 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request_id))
    throw new Error('Refresh the form and try again.');
  const name = text('name', 160), email = text('email', 254), message = text('message', 4000);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  return { request_id, name, email, message };
}

export function supportOriginAllowed(origin) {
  try {
    const url = new URL(origin);
    return url.origin === origin && url.protocol === 'https:' && !url.port &&
      (url.hostname === 'closeandrelax.com' || url.hostname.endsWith('.closeandrelax.com'));
  } catch { return false; }
}

export function createSupportHandler({ env, fetcher = fetch, save, authenticate = async () => null, cryptoApi = crypto }) {
  return async (request) => {
    const origin = request.headers.get('origin') || '';
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin' };
    if (supportOriginAllowed(origin)) Object.assign(headers, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    });
    const reply = (status, body) => new Response(body == null ? null : JSON.stringify(body), { status, headers });
    if (!supportOriginAllowed(origin)) return reply(403, { error: 'Request unavailable.' });
    if (request.method === 'OPTIONS') return reply(204, null);
    if (request.method !== 'POST') return reply(405, { error: 'Use POST.' });
    if (!['TURNSTILE_SECRET_KEY', 'SUPPORT_RATE_LIMIT_SALT', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].every((key) => env(key)))
      return reply(503, { error: 'Support is temporarily unavailable. Please try again later.' });
    try {
      if (Number(request.headers.get('content-length') || 0) > 20000) return reply(413, { error: 'Message too large.' });
      const raw = await request.text();
      if (new TextEncoder().encode(raw).length > 20000) return reply(413, { error: 'Message too large.' });
      let input, message;
      try {
        input = JSON.parse(raw);
        if (input.company_website) throw new Error();
        message = validateSupportContact(input);
      } catch { return reply(400, { error: 'Check your name, email, and message.' }); }
      const requestType = input.request_type ?? 'general';
      if (!['general', 'account_closure'].includes(requestType)) return reply(400, { error: 'Invalid support request.' });
      if (requestType === 'account_closure') {
        const bearer = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
        let user;
        try { user = bearer ? await authenticate(bearer) : null; } catch { user = null; }
        if (!user?.id || user.is_anonymous || !user.email || !/^[0-9a-f-]{36}$/i.test(user.id))
          return reply(401, { error: 'Log in again before requesting account closure.' });
        // Identity comes from Auth, never from typed email, metadata or a client profile ID.
        // This records a request only; staff must verify ownership before taking action.
        if (message.message.length > 3500) return reply(400, { error: 'Keep closure requests within 3500 characters.' });
        message = validateSupportContact({ ...message, email: user.email,
          message: `Account closure request\nAuthenticated account: ${user.id}\nManual review required; no deletion or unpublish performed.\n\n${message.message}` });
      }
      if (typeof input.captcha_token !== 'string' || !input.captcha_token || input.captcha_token.length > 2048)
        return reply(400, { error: 'Complete verification before sending.' });
      const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST', signal: AbortSignal.timeout(10000),
        body: new URLSearchParams({ secret: env('TURNSTILE_SECRET_KEY'), response: input.captcha_token }),
      });
      const captcha = await response.json();
      if (!response.ok || !captcha.success || captcha.action !== 'support_contact' || captcha.hostname !== new URL(origin).hostname)
        return reply(400, { error: 'Verification expired. Please retry verification.' });
      const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0].trim();
      if (!ip) return reply(503, { error: 'Support is temporarily unavailable. Please try again later.' });
      const key = await cryptoApi.subtle.importKey('raw', new TextEncoder().encode(env('SUPPORT_RATE_LIMIT_SALT')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const digest = await cryptoApi.subtle.sign('HMAC', key, new TextEncoder().encode(`support:${ip}`));
      const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
      const { data, error } = await save(message, hash);
      if (error || data !== message.request_id) return reply(error?.code === 'P0429' ? 429 : 503, {
        error: error?.code === 'P0429' ? 'Too many messages. Please try again in an hour.' : 'Your message could not be confirmed. Please retry with this form.',
      });
      return reply(201, { accepted: true, reference: data });
    } catch { return reply(503, { error: 'Your message could not be confirmed. Please retry with this form.' }); }
  };
}
