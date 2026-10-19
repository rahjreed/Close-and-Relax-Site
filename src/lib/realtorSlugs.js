// Keep this list/rules aligned with public.is_valid_realtor_slug(text).
export const RESERVED_REALTOR_SLUGS = Object.freeze([
  'www', 'app', 'admin', 'api', 'auth', 'login', 'logout', 'signup',
  'dashboard', 'support', 'billing', 'insurance', 'mail', 'smtp', 'ftp',
  'static', 'assets', 'cdn', 'status', 'account', 'accounts', 'settings',
  'contact', 'help', 'pricing', 'plans', 'benefits', 'privacy', 'terms',
  'reset-password', 'forgot-password', 'verify', 'oauth', 'callback',
  'webmail', 'autodiscover', 'imap', 'pop', 'pop3', 'mx', 'dns', 'ns1', 'ns2',
  'dev', 'test', 'staging', 'preview', 'localhost', 'closeandrelax',
]);
const reserved = new Set(RESERVED_REALTOR_SLUGS);
export function realtorSlugError(value) {
  if (typeof value !== 'string' || !value.length) return 'Choose a Realtor subdomain.';
  if (value.length > 63) return 'Use 1–63 characters for your subdomain.';
  if (/[^a-z0-9-]/.test(value) || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(value))
    return 'Use lowercase letters, numbers, and hyphens, with no spaces or hyphens at either end.';
  if (reserved.has(value)) return 'That subdomain is reserved for Close & Relax. Please choose another.';
  return '';
}
export const isValidRealtorSlug = (value) => !realtorSlugError(value);
