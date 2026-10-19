import { profileForHub } from './profileBranding.js';
import { loadHubVendors } from './vendorVisibility.js';

export async function requirePreviewOwner(client, expectedUserId) {
  const { data, error } = await client.auth.getUser();
  if (error || !expectedUserId || data?.user?.id !== expectedUserId)
    throw new Error('Sign in to preview your own hub.');
  return data.user;
}

// No profile ID, slug or token from a URL is used to select draft data.
export async function loadOwnHubPreview(client, expectedUserId, getPlanConfig) {
  const user = await requirePreviewOwner(client, expectedUserId);
  const { data: profile, error } = await client.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error || !profile || profile.id !== user.id) throw new Error('Your saved hub could not be loaded.');
  const plan = getPlanConfig(profile.plan);
  const collection = async (table) => {
    const { data, error: loadError } = await client.from(table).select('*')
      .eq('profile_id', user.id).eq('is_active', true)
      .order('sort_order', { ascending: true }).order('created_at', { ascending: true });
    if (loadError || (data || []).some((row) => row.profile_id !== user.id))
      throw new Error('Your saved hub content could not be loaded. Please retry.');
    return (data || []).filter((row) => row.is_active !== false);
  };
  const [vendors, checklist, sections] = await Promise.all([
    loadHubVendors(client, user.id),
    plan.allowsChecklist ? collection('homeowner_checklist_items') : Promise.resolve([]),
    plan.allowsCustomSections ? collection('custom_hub_sections') : Promise.resolve([]),
  ]);
  await requirePreviewOwner(client, user.id);
  return {
    ...profileForHub(profile),
    welcome_video_url: plan.allowsWelcomeVideo ? (profile.welcome_video_url || '') : '',
    vendors: vendors.map((vendor) => ({ ...vendor, recommendation: plan.allowsVendorRecommendations ? vendor.recommendation : null })),
    vendor_loading: false, vendor_load_error: false,
    checklist_items: checklist, custom_hub_sections: sections,
  };
}
