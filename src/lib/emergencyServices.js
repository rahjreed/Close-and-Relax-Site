import { supabase } from './supabase';

// Fixed platform slots also serve as a safe fallback before migrations are applied.
export const EMERGENCY_CATEGORIES = Object.freeze([
  { code: 'plumbing', label: 'Plumbing', sort_order: 1 },
  { code: 'heating-cooling', label: 'Heating & Cooling', sort_order: 2 },
  { code: 'electrical', label: 'Electrical', sort_order: 3 },
  { code: 'locksmith', label: 'Locksmith', sort_order: 4 },
  { code: 'fire-water-restoration', label: 'Fire & Water Restoration', sort_order: 5 },
  { code: 'roofing-storm-damage', label: 'Roofing / Storm Damage', sort_order: 6 },
]);

export const EMERGENCY_ASSIGNMENT_FIELDS =
  'profile_id, category_code, provider_name, phone, website, availability_status, availability_confirmation_method, availability_confirmed_at, created_at, updated_at';
export const CONFIRMATION_METHODS = [
  { value: 'provider_confirmation', label: 'Confirmed directly with the provider' },
  { value: 'business_website', label: 'Confirmed on the provider’s website' },
];

export function normalizeEmergencyWebsite(value = '') {
  const input = String(value || '').trim();
  if (!input) return '';
  // Reject explicit non-web protocols rather than turning them into HTTPS hosts.
  if (/^[a-z][a-z0-9+.-]*:/i.test(input) && !/^https?:\/\//i.test(input)) {
    throw new Error('Use an http:// or https:// website address.');
  }
  const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password
  ) {
    throw new Error('Enter a valid provider website address.');
  }
  return url.href;
}

export function emergencyPhoneHref(value = '') {
  return String(value || '').replace(/[^0-9+]/g, '');
}

export function hasConfirmedEmergencyAvailability(assignment) {
  return (
    assignment?.availability_status === 'confirmed_24_7' &&
    Boolean(assignment.availability_confirmed_at) &&
    Number.isFinite(Date.parse(assignment.availability_confirmed_at)) &&
    CONFIRMATION_METHODS.some(({ value }) => value === assignment.availability_confirmation_method)
  );
}

export function validateEmergencyAssignment(profileId, categoryCode, form) {
  if (!profileId) throw new Error('Sign in to manage emergency contacts.');
  if (!EMERGENCY_CATEGORIES.some(({ code }) => code === categoryCode))
    throw new Error('Choose a supported emergency category.');
  const providerName = String(form.provider_name || '').trim();
  const phone = String(form.phone || '').trim();
  if (!providerName || providerName.length > 160)
    throw new Error('Enter a provider name of up to 160 characters.');
  if (
    phone.length > 50 ||
    !/^[+0-9().\s-]+$/.test(phone) ||
    phone.replace(/\D/g, '').length < 7 ||
    phone.replace(/\D/g, '').length > 15
  ) {
    throw new Error('Enter a provider phone number containing 7–15 digits.');
  }
  const confirmed = form.availability_status === 'confirmed_24_7';
  const method = confirmed ? form.availability_confirmation_method : null;
  if (confirmed && !CONFIRMATION_METHODS.some(({ value }) => value === method)) {
    throw new Error('Choose how you confirmed 24/7 availability.');
  }
  let website;
  try {
    website = normalizeEmergencyWebsite(form.website);
  } catch {
    throw new Error('Enter a valid http:// or https:// provider website.');
  }
  if (website.length > 2048) throw new Error('The website address is too long.');
  return {
    profile_id: profileId,
    category_code: categoryCode,
    provider_name: providerName,
    phone,
    website: website || null,
    availability_status: confirmed ? 'confirmed_24_7' : 'unknown',
    availability_confirmation_method: method,
  };
}

export async function loadEmergencyServices(profileId) {
  if (!profileId) return { categories: EMERGENCY_CATEGORIES, assignments: [], error: null };
  const [categoryResult, assignmentResult] = await Promise.allSettled([
    supabase
      .from('emergency_service_categories')
      .select('code, label, sort_order')
      .order('sort_order'),
    supabase
      .from('emergency_service_assignments')
      .select(EMERGENCY_ASSIGNMENT_FIELDS)
      .eq('profile_id', profileId),
  ]);
  const categories =
    categoryResult.status === 'fulfilled' && !categoryResult.value.error
      ? categoryResult.value.data || []
      : [];
  const failed =
    categoryResult.status === 'rejected' ||
    categoryResult.value?.error ||
    assignmentResult.status === 'rejected' ||
    assignmentResult.value?.error;
  return {
    // A catalog outage or missing row must never remove a fixed category.
    categories: EMERGENCY_CATEGORIES.map((fallback) => ({
      ...fallback,
      ...categories.find(({ code }) => code === fallback.code),
    })),
    assignments:
      assignmentResult.status === 'fulfilled' && !assignmentResult.value.error
        ? assignmentResult.value.data || []
        : [],
    error: failed
      ? 'Emergency contacts are temporarily unavailable. Please try again shortly.'
      : null,
  };
}

export async function saveEmergencyAssignment(profileId, categoryCode, form) {
  const payload = validateEmergencyAssignment(profileId, categoryCode, form);
  const { data, error } = await supabase
    .from('emergency_service_assignments')
    .upsert(payload, { onConflict: 'profile_id,category_code' })
    .select(EMERGENCY_ASSIGNMENT_FIELDS)
    .single();
  if (error) throw new Error('Unable to save this emergency provider. Please try again.');
  return data;
}

export async function clearEmergencyAssignment(profileId, categoryCode) {
  if (!profileId || !EMERGENCY_CATEGORIES.some(({ code }) => code === categoryCode))
    throw new Error('Choose a supported emergency category.');
  const { error } = await supabase
    .from('emergency_service_assignments')
    .delete()
    .eq('profile_id', profileId)
    .eq('category_code', categoryCode);
  if (error) throw new Error('Unable to clear this emergency provider. Please try again.');
}
