import { requirePreviewOwner } from './hubPreview.js';

const filled = (value) => typeof value === 'string' && Boolean(value.trim());
const savedFor = (rows, profileId) => (Array.isArray(rows) ? rows : []).filter(
  (row) => row?.id && row.profile_id === profileId && row.is_active !== false,
);

// Capabilities come from the dashboard's existing getPlanConfig; no new plan rules.
export function getRealtorSetup({ profile, planConfig = {}, vendors = [], checklistItems = [], customSections = [], standardResourcesAvailable = false, previewRequestedAt = null }) {
  const hasProfile = Boolean(profile?.id);
  const hasLink = hasProfile && filled(profile.slug);
  const ownVendors = hasProfile ? savedFor(vendors, profile.id) : [];
  const needsCustomBranding = Boolean(planConfig.allowsPremiumProfile);
  const customResources = Boolean(planConfig.allowsChecklist || planConfig.allowsCustomSections);
  const hasResources = hasProfile && (
    (planConfig.allowsChecklist && savedFor(checklistItems, profile.id).length > 0) ||
    (planConfig.allowsCustomSections && savedFor(customSections, profile.id).length > 0)
  );
  const steps = [
    {
      id: 'profile', title: 'Complete profile', action: 'Complete profile',
      complete: hasProfile && ['full_name', 'brokerage', 'phone', 'city'].every((field) => filled(profile[field])),
      detail: 'Save your name, brokerage, phone number and city.',
    },
    {
      id: 'branding', title: 'Add your branding', action: 'Edit branding',
      complete: hasLink && (!needsCustomBranding || (filled(profile.headshot_url) && filled(profile.welcome_message))),
      detail: needsCustomBranding
        ? `Save your hub link, headshot and welcome message. Bio and social links${planConfig.allowsWelcomeVideo || planConfig.allowsCustomAppIcon ? ', video and app initials' : ''} are optional.`
        : 'Your Free hub includes standard branding. Just save your hub link—no headshot or custom welcome required.',
    },
    {
      id: 'vendors', title: 'Add preferred vendors', action: 'Add vendor',
      complete: ownVendors.some((vendor) => vendor.is_default !== true),
      detail: 'Add one active vendor of your own. Included default resources don’t count; you don’t need to fill your limit.',
    },
    {
      id: 'resources', title: 'Add homeowner resources', action: 'Add resources',
      complete: customResources ? Boolean(hasResources) : hasProfile && standardResourcesAvailable,
      detail: customResources
        ? 'Save one active homeowner checklist item or custom hub section.'
        : 'Standard homeowner resources are included automatically. No paid tools or extra setup required.',
      alternativeAction: planConfig.allowsCustomSections ? 'Add a custom section' : null,
    },
    {
      id: 'preview', title: 'Preview your hub', action: 'Preview hub',
      complete: hasProfile && typeof previewRequestedAt === 'string' && Number.isFinite(Date.parse(previewRequestedAt)),
      disabled: !hasProfile,
      detail: 'Review your saved hub privately before publishing. Preview completion is saved to your account.',
    },
    {
      id: 'publish', title: 'Publish your hub', action: 'Publish hub',
      complete: hasProfile && profile?.is_published === true,
      detail: 'Make your saved hub available at your Realtor link. You can keep editing after publishing.',
    },
  ];
  const completed = steps.filter((step) => step.complete).length;
  return { steps, completed, total: steps.length, percent: Math.round(completed / steps.length * 100), allComplete: completed === steps.length };
}

export const PREVIEW_METADATA_KEY = 'closeandrelax_hub_previewed_at';

export function previewHistoryFromUser(user) {
  const value = user?.user_metadata?.[PREVIEW_METADATA_KEY];
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
}

export async function readRealtorPreview(client, userId) {
  return previewHistoryFromUser(await requirePreviewOwner(client, userId));
}

// Advisory onboarding history only. Never use user-editable metadata for access.
export async function recordRealtorPreview(client, userId) {
  const user = await requirePreviewOwner(client, userId);
  const existing = previewHistoryFromUser(user);
  if (existing) return existing;
  const { data, error } = await client.auth.updateUser({
    data: { [PREVIEW_METADATA_KEY]: new Date().toISOString() },
  });
  const saved = previewHistoryFromUser(data?.user);
  if (error || data?.user?.id !== userId || !saved) throw new Error('Preview history could not be saved.');
  return saved;
}

