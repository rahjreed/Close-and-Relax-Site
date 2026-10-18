import assert from 'node:assert/strict';
import test from 'node:test';
import { getRealtorSetup, PREVIEW_METADATA_KEY, previewHistoryFromUser, readRealtorPreview, recordRealtorPreview } from '../src/lib/realtorSetup.js';

const profile = { id: 'realtor-a', full_name: 'Pat Realtor', brokerage: 'Example Realty', phone: '3175550100', city: 'Indianapolis', slug: 'pat', is_published: false };
const plans = {
  Free: { allowsPremiumProfile: false, allowsChecklist: false, allowsCustomSections: false },
  Core: { allowsPremiumProfile: true, allowsChecklist: false, allowsCustomSections: false },
  Pro: { allowsPremiumProfile: true, allowsChecklist: true, allowsCustomSections: true, allowsWelcomeVideo: true, allowsCustomAppIcon: true },
};
const input = { profile, planConfig: plans.Free, standardResourcesAvailable: true };
const step = (data, id) => getRealtorSetup({ ...input, ...data }).steps.find((s) => s.id === id);
const row = (data = {}) => ({ id: 'saved-row', profile_id: profile.id, is_active: true, ...data });

test('profile progress uses all four saved fields, ignores whitespace/fallbacks and changes immediately', () => {
  assert(step({}, 'profile').complete);
  for (const field of ['full_name', 'brokerage', 'phone', 'city'])
    assert(!step({ profile: { ...profile, [field]: ' ' } }, 'profile').complete);
  assert(!step({ profile: null }, 'profile').complete);
});

test('Free requires no premium branding; Core/Pro require headshot and welcome but no optional upgrades', () => {
  assert(step({}, 'branding').complete);
  assert(!step({ profile: { ...profile, slug: '' } }, 'branding').complete);
  for (const name of ['Core', 'Pro']) {
    assert(!step({ planConfig: plans[name] }, 'branding').complete);
    assert(!step({ planConfig: plans[name], profile: { ...profile, headshot_url: 'saved.jpg' } }, 'branding').complete);
    assert(step({ planConfig: plans[name], profile: { ...profile, headshot_url: 'saved.jpg', welcome_message: 'Welcome home!' } }, 'branding').complete);
  }
  assert(!step({ planConfig: plans.Core }, 'branding').detail.includes('video'));
});

test('one saved active non-default vendor is sufficient; defaults, inactive/unsaved/other-owner rows do not count', () => {
  for (const vendor of [row({ is_default: true }), row({ is_active: false }), row({ id: undefined }), row({ profile_id: 'someone-else' })])
    assert(!step({ vendors: [vendor] }, 'vendors').complete);
  assert(step({ vendors: [row({ is_default: true }), row({ is_default: false })] }, 'vendors').complete);
});

test('Free/Core use included resources without paid blockers; Pro needs either active checklist or custom section', () => {
  for (const name of ['Free', 'Core']) {
    assert(step({ planConfig: plans[name] }, 'resources').complete);
    assert.equal(step({ planConfig: plans[name] }, 'resources').alternativeAction, null);
  }
  assert(!step({ planConfig: plans.Pro }, 'resources').complete);
  assert(step({ planConfig: plans.Pro, checklistItems: [row()] }, 'resources').complete);
  assert(step({ planConfig: plans.Pro, customSections: [row()] }, 'resources').complete);
  assert(!step({ planConfig: plans.Pro, checklistItems: [row({ is_active: false })], customSections: [row({ profile_id: 'other' })] }, 'resources').complete);
});

test('preview requires a recorded action; publish follows saved is_published and never follows preview state', () => {
  assert(!step({}, 'preview').complete);
  assert(!step({}, 'preview').disabled);
  assert(!step({ profile: { ...profile, is_published: true } }, 'preview').disabled);
  assert(!step({ previewRequestedAt: 'bad' }, 'preview').complete);
  assert(step({ previewRequestedAt: '2026-10-18T12:00:00Z' }, 'preview').complete);
  assert(!step({ previewRequestedAt: '2026-10-18T12:00:00Z' }, 'publish').complete);
  assert(step({ profile: { ...profile, is_published: true } }, 'publish').complete);
});

test('every plan can reach six of six/100%; edits, removals, unpublishing and plan upgrades recalculate progress', () => {
  for (const name of ['Free', 'Core', 'Pro']) {
    const data = { ...input, planConfig: plans[name], profile: { ...profile, headshot_url: 'saved.jpg', welcome_message: 'Welcome!', is_published: true }, vendors: [row({ is_default: false })], checklistItems: [row()], previewRequestedAt: '2026-10-18T12:00:00Z' };
    assert.deepEqual([getRealtorSetup(data).completed, getRealtorSetup(data).percent, getRealtorSetup(data).allComplete], [6, 100, true]);
    assert.equal(getRealtorSetup({ ...data, vendors: [] }).completed, 5);
    assert.equal(getRealtorSetup({ ...data, profile: { ...data.profile, is_published: false } }).completed, 5);
  }
  assert.equal(getRealtorSetup(input).completed, 3);
  assert.equal(getRealtorSetup({ ...input, planConfig: plans.Pro }).completed, 1);
});

test('preview history is saved only through the authenticated account and is fresh across devices', async () => {
  let user = { id: 'a', user_metadata: { untouched: 'preserved' } }, writes = 0;
  const device = () => ({ auth: {
    getUser: async () => ({ data: { user }, error: null }),
    updateUser: async ({ data }) => { writes++; assert.deepEqual(Object.keys(data), [PREVIEW_METADATA_KEY]); user = { ...user, user_metadata: { ...user.user_metadata, ...data } }; return { data: { user }, error: null }; },
  } });
  assert.equal(await readRealtorPreview(device(), 'a'), null);
  const saved = await recordRealtorPreview(device(), 'a');
  assert(saved); assert.equal(writes, 1);
  assert.equal(await readRealtorPreview(device(), 'a'), saved);
  assert.equal(user.user_metadata.untouched, 'preserved');
  assert.equal(await recordRealtorPreview(device(), 'a'), saved); assert.equal(writes, 1);
  await assert.rejects(recordRealtorPreview(device(), 'b'));
  user = null;
  await assert.rejects(readRealtorPreview(device(), 'a'));
  await assert.rejects(recordRealtorPreview(device(), 'a')); assert.equal(writes, 1);
  assert.equal(previewHistoryFromUser({ user_metadata: { [PREVIEW_METADATA_KEY]: 'bad' } }), null);
});

test('failed Auth metadata writes do not complete preview history or publish anything', async () => {
  const client = { auth: { getUser: async () => ({ data: { user: { id: 'a' } } }), updateUser: async () => ({ data: { user: null }, error: new Error('Unavailable') }) } };
  await assert.rejects(recordRealtorPreview(client, 'a'), /could not be saved/);
  assert.equal(await readRealtorPreview(client, 'a'), null);
});
