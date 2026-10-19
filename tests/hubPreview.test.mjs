import assert from 'node:assert/strict';
import test from 'node:test';
import { loadOwnHubPreview } from '../src/lib/hubPreview.js';

const owner = 'owner-a';
const configs = {
  partner: { allowsPremiumProfile: false, allowsVendorRecommendations: false },
  pro: { allowsPremiumProfile: true, allowsVendorRecommendations: true },
  premier: { allowsPremiumProfile: true, allowsVendorRecommendations: true, allowsChecklist: true, allowsCustomSections: true, allowsWelcomeVideo: true },
};
function fixture({ user = { id: owner }, profile = { id: owner, plan: 'premier', is_published: false }, rows = {}, failedTable, nextUser } = {}) {
  const requests = []; let authReads = 0;
  const client = {
    auth: { getUser: async () => ({ data: { user: authReads++ && nextUser !== undefined ? nextUser : user }, error: null }) },
    rpc: async (name,args) => {
      requests.push({rpc:name,args});
      return {data:rows.vendors || [],error:failedTable==='vendors'?new Error('Read failed'):null};
    },
    from(table) {
      const request = { table, filters: [] }; requests.push(request);
      const query = {
        select() { return query; }, eq(...filter) { request.filters.push(filter); return query; }, order() { return query; },
        maybeSingle: async () => ({ data: profile, error: null }),
        then(resolve, reject) { return Promise.resolve({ data: rows[table] || [], error: table === failedTable ? new Error('Read failed') : null }).then(resolve, reject); },
      };
      return query;
    },
  };
  return { client, requests, planFor: (plan) => configs[plan] || configs.partner };
}

test('unpublished owner preview loads saved content through owner-scoped authenticated reads', async () => {
  const f = fixture({ rows: { vendors: [{ id: 'v', profile_id: owner, is_active: true }], homeowner_checklist_items: [{ id: 'c', profile_id: owner, is_active: true }], custom_hub_sections: [{ id: 's', profile_id: owner, is_active: true }] } });
  const result = await loadOwnHubPreview(f.client, owner, f.planFor);
  assert.equal(result.is_published, false);
  assert.equal(result.vendors[0].id, 'v'); assert.equal(result.checklist_items[0].id, 'c'); assert.equal(result.custom_hub_sections[0].id, 's');
  assert.deepEqual(f.requests[0].filters, [['id', owner]]);
  for (const query of f.requests.slice(1).filter(query=>!query.rpc)) assert.deepEqual(query.filters, [['profile_id', owner], ['is_active', true]]);
  assert.deepEqual(f.requests.find(query=>query.rpc),{rpc:'get_hub_vendors',args:{hub_profile_id:owner}});
  assert.equal(f.requests.length, 4);
});

test('anonymous and other-account preview attempts fail before any draft query, regardless of metadata', async () => {
  for (const user of [null, { id: 'other', user_metadata: { plan: 'premier', closeandrelax_hub_previewed_at: '2026-10-18T12:00:00Z' } }]) {
    const f = fixture({ user });
    await assert.rejects(loadOwnHubPreview(f.client, owner, f.planFor), /own hub/);
    assert.equal(f.requests.length, 0);
  }
});

test('unexpected foreign profile/content and identity changes fail closed', async () => {
  for (const options of [{ profile: { id: 'other' } }, { rows: { vendors: [{ id: 'v', profile_id: 'other' }] } }, { nextUser: { id: 'other' } }]) {
    const f = fixture(options);
    await assert.rejects(loadOwnHubPreview(f.client, owner, f.planFor));
  }
});

test('Free/Core preview respects saved plan capabilities and hides inactive or paid-only content', async () => {
  for (const plan of ['partner', 'pro']) {
    const f = fixture({ user: { id: owner, user_metadata: { plan: 'premier' } }, profile: { id: owner, plan, headshot_url: 'photo', photo_url: 'legacy', welcome_message: 'welcome', welcome_video_url: 'video' }, rows: { vendors: [{ id: 'v', profile_id: owner, is_active: true, recommendation: 'note' }, { id: 'hidden', profile_id: owner, is_active: false }] } });
    const result = await loadOwnHubPreview(f.client, owner, f.planFor);
    assert.equal(f.requests.length, 2); assert.deepEqual(result.checklist_items, []); assert.deepEqual(result.custom_hub_sections, []);
    assert.equal(result.welcome_video_url, ''); assert.equal(result.vendors.length, 1);
    assert.equal(result.vendors[0].recommendation, plan === 'pro' ? 'note' : null);
    assert.equal(result.headshot_url, plan === 'pro' ? 'photo' : '');
  }
});

test('collection errors prevent a partial preview from being treated as successfully loaded', async () => {
  const f = fixture({ failedTable: 'vendors' });
  await assert.rejects(loadOwnHubPreview(f.client, owner, f.planFor), /could not be loaded/);
});
