export { validateSupportContact } from '../../supabase/functions/_shared/supportContact.js';

// Temporary public fallback approved for launch; replace via VITE_SUPPORT_FALLBACK_URL.
export const DEFAULT_SUPPORT_FALLBACK_URL = 'mailto:hello@callistadigital.com';

// Only an explicitly approved PUBLIC contact destination belongs in this variable.
export function supportFallbackUrl(value = DEFAULT_SUPPORT_FALLBACK_URL) {
  if (typeof value === 'string' && !value.trim()) value = DEFAULT_SUPPORT_FALLBACK_URL;
  if (typeof value !== 'string' || /[\s\r\n]/.test(value)) return '';
  if (/^mailto:[^?@]+@[^?@]+\.[^?@]+$/.test(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

export async function sendSupportMessage(client, message, token, honeypot = '', requestType = 'general') {
  if (!token) throw new Error('Complete verification before sending.');
  if (!['general', 'account_closure'].includes(requestType)) throw new Error('Invalid support request.');
  if (requestType === 'account_closure') {
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user?.id || data.user.is_anonymous || !data.user.email)
      throw new Error('Log in again before requesting account closure. Your draft is still here.');
  }
  let rateLimited = false;
  try {
    const { data, error } = await client.functions.invoke('support-contact', {
      body: { ...message, request_type: requestType, captcha_token: token, company_website: honeypot },
      timeout: 20000,
    });
    rateLimited = error?.context?.status === 429;
    if (error || data?.accepted !== true || data.reference !== message.request_id) throw new Error();
    return data.reference;
  } catch {
    if (rateLimited) throw new Error('Too many messages. Your draft is still here. Please wait an hour before trying again, or use the alternative contact below if available.');
    throw new Error('Your message could not be confirmed. Your draft is still here. Retry verification and send again, or use the alternative contact below if available.');
  }
}
