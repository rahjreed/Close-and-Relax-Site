const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isInsurancePath = (pathname) => /^\/insurance\/?$/.test(pathname || '');

export function insuranceReferral(search = '') {
  const params = new URLSearchParams(search);
  const refs = params.getAll('ref');
  if (!refs.length) return { profileId: null, error: '' };
  if (refs.length !== 1 || !UUID.test(refs[0]))
    return {
      profileId: null,
      error: 'This referral link is invalid. Please use the standalone insurance link below.',
    };
  return { profileId: refs[0], error: '' };
}

export function insuranceUrl(profileId) {
  const base = 'https://closeandrelax.com/insurance';
  return typeof profileId === 'string' && UUID.test(profileId)
    ? `${base}?ref=${encodeURIComponent(profileId)}`
    : base;
}
