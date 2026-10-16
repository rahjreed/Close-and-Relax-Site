import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HOMEOWNER_SAVINGS_OFFERS,
  SAVINGS_CLICK_EVENTS,
  canHideHomeownerSavings,
  shouldShowHomeownerSavings,
  normalizeSavingsUrl,
  resolveHomeownerSavingsOffers,
  loadHomeownerSavingsDestinations,
  saveHomeownerSavingsVisibility,
} from '../src/lib/homeownerSavings.js';
import { getVivintTextHref, VIVINT_CONTACT_PHONE } from '../src/lib/partnerContacts.js';

test('Free/Core and all existing aliases stay visible even with a false flag', () => {
  for (const plan of ['partner', 'free', 'pro', 'core', 'PRO', null, '', 'unknown']) {
    assert.equal(canHideHomeownerSavings(plan), false);
    assert.equal(shouldShowHomeownerSavings({ plan, homeowner_savings_visible: false }), true);
  }
});

test('only internal premier may hide; all profiles default to shown', () => {
  for (const plan of ['premier', 'PREMIER']) {
    assert.equal(canHideHomeownerSavings(plan), true);
    assert.equal(shouldShowHomeownerSavings({ plan }), true);
    assert.equal(shouldShowHomeownerSavings({ plan, homeowner_savings_visible: null }), true);
    assert.equal(shouldShowHomeownerSavings({ plan, homeowner_savings_visible: false }), false);
    assert.equal(shouldShowHomeownerSavings({ plan, homeowner_savings_visible: true }), true);
  }
  assert.equal(shouldShowHomeownerSavings(null), true);
});

test('launch offers are fixed Vivint and Goosehead; missing configuration cannot remove cards', () => {
  assert.deepEqual(
    HOMEOWNER_SAVINGS_OFFERS.map((o) => o.code),
    ['vivint', 'goosehead'],
  );
  for (const rows of [[], [{ code: 'unapproved', cta_url: 'https://example.com' }]]) {
    const offers = resolveHomeownerSavingsOffers(rows);
    assert.equal(offers.length, 2);
    assert(offers[0].href.startsWith(`sms:${VIVINT_CONTACT_PHONE}`));
    assert.equal(offers[1].href, 'https://closeandrelax.com/insurance');
    assert.equal(offers[1].requestForm, undefined);
  }
});

test('Vivint configuration overrides its fallback; Goosehead always uses the private request form', () => {
  const offers = resolveHomeownerSavingsOffers([
    { code: 'vivint', cta_url: 'https://example.com/security' },
    { code: 'goosehead', cta_url: 'https://example.com/insurance' },
  ]);
  assert.equal(offers[0].href, 'https://example.com/security');
  assert.equal(offers[1].href, 'https://closeandrelax.com/insurance');
  assert.equal(offers[1].requestForm, undefined);
  assert.equal(offers[1].external, false);
  assert.equal(offers[0].external, true);
  for (const invalid of [
    '',
    'javascript:alert(1)',
    'data:text/html,test',
    'https://user:pass@example.com',
    'not a URL',
  ]) {
    assert.equal(normalizeSavingsUrl(invalid), '');
  }
});

test('shared Vivint contact preserves existing Realtor message and separates homeowner copy', () => {
  const existingMessage =
    "Hi Roger, I'm a Close & Relax realtor and I'd like to claim the Vivint Realtor Benefit.";
  assert.equal(
    getVivintTextHref('realtor'),
    `sms:4632813454?body=${encodeURIComponent(existingMessage)}`,
  );
  assert(!decodeURIComponent(getVivintTextHref('homeowner')).includes('Realtor Benefit'));
});

test('tracking adds exactly two separate event types', () => {
  assert.deepEqual(SAVINGS_CLICK_EVENTS, {
    vivint: 'savings_vivint_click',
    goosehead: 'savings_goosehead_click',
  });
});

test('configuration failures produce safe default cards without blocking the hub', async () => {
  const client = {
    from(table) {
      assert.equal(table, 'homeowner_savings_offers');
      return { select: async () => ({ error: new Error('offline') }) };
    },
  };
  const result = await loadHomeownerSavingsDestinations(client);
  assert(result.error);
  assert.equal(result.offers.length, 2);
  assert(result.offers[0].href.startsWith('sms:'));
  assert.equal(result.offers[1].href, 'https://closeandrelax.com/insurance');
});

test('visibility writes use only the current profile flag and reject non-Pro callers', async () => {
  const writes = [];
  const client = {
    from(table) {
      assert.equal(table, 'profiles');
      return {
        update(payload) {
          writes.push(payload);
          return {
            eq(column, id) {
              assert.equal(column, 'id');
              assert.equal(id, 'owner');
              return {
                select: () => ({
                  single: async () => ({ data: { id, plan: 'premier', ...payload }, error: null }),
                }),
              };
            },
          };
        },
      };
    },
  };
  await assert.rejects(saveHomeownerSavingsVisibility(client, { id: 'owner', plan: 'pro' }, false));
  assert.equal(writes.length, 0);
  const result = await saveHomeownerSavingsVisibility(
    client,
    { id: 'owner', plan: 'premier' },
    false,
  );
  assert.deepEqual(writes, [{ homeowner_savings_visible: false }]);
  assert.equal(result.homeowner_savings_visible, false);
});
