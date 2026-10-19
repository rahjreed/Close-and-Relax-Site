import { isValidRealtorSlug } from './realtorSlugs.js';

// Defense in depth for public rendering and private preview. Never mutate the
// saved owner profile: paid content must remain available after re-upgrading.
export const CORE_BRANDING_FIELDS = Object.freeze([
  'headshot_url', 'photo_url', 'profile_image_url', 'image_url',
  'welcome_message', 'welcome', 'bio', 'website_url', 'website',
  'instagram_url', 'facebook_url', 'linkedin_url',
]);
export const PRO_BRANDING_FIELDS = Object.freeze([
  'welcome_video_url', 'video_url', 'app_icon_initials', 'app_initials',
]);
export function profileForHub(profile) {
  if (!profile) return profile;
  const result = { ...profile };
  const plan = String(profile.plan || 'partner').toLowerCase();
  if (!['pro', 'core', 'premier'].includes(plan))
    for (const field of CORE_BRANDING_FIELDS) result[field] = '';
  if (plan !== 'premier')
    for (const field of PRO_BRANDING_FIELDS) result[field] = '';
  return result;
}

export async function loadPublicHubProfile(client, slug) {
  if (!isValidRealtorSlug(slug)) return null;
  // No fallback to SELECT *: the RPC is the server-side publication/branding boundary.
  const { data, error } = await client.rpc('get_public_realtor_profile', { hub_slug: slug });
  if (error) throw new Error('Unable to load this homeowner hub. Please try again.');
  if (!data) return null;
  if (data.is_published !== true || data.slug !== slug)
    throw new Error('This homeowner hub is unavailable.');
  return profileForHub(data);
}
