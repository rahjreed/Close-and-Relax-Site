import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { CATALOG, STAGING_URL, checkoutPrice, FOUNDING_END, effectiveTier, paidEntitlement, blocksCheckout } from '../server/billing-policy.js';
import { configuration } from '../server/billing.js';

test('server price allowlist maps public names to existing tiers and rejects injected fields', () => {
  assert.equal(checkoutPrice('core', false, FOUNDING_END), CATALOG.core.founding);
  assert.equal(checkoutPrice('pro', false, FOUNDING_END), CATALOG.pro.founding);
  for (const name of ['premier', 'partner', 'price_arbitrary', '__proto__', 'constructor']) assert.throws(() => checkoutPrice(name, false));
});
test('founding closes at the existing Eastern deadline and never returns after cancellation', () => {
  assert.equal(checkoutPrice('core', false, FOUNDING_END + 1), CATALOG.core.regular);
  assert.equal(checkoutPrice('pro', true, FOUNDING_END - 1), CATALOG.pro.regular);
  assert.equal(checkoutPrice('core', true, FOUNDING_END + 1000), CATALOG.core.regular);
});
test('failed payment and cancellation keep only the previously paid term; exact expiry and risk holds remove access', () => {
  const row = { paid_tier: 'premier', paid_through: '2027-02-01T00:00:00Z', status: 'past_due' };
  assert.equal(effectiveTier(row, Date.parse('2027-01-31T23:59:59Z')), 'premier');
  assert.equal(effectiveTier({ ...row, status: 'canceled' }, Date.parse('2027-01-31T23:59:59Z')), 'premier');
  assert.equal(effectiveTier(row, Date.parse(row.paid_through)), 'partner');
  assert.equal(effectiveTier({ ...row, risk_hold: true }, 1), 'partner');
  assert.equal(effectiveTier(null), 'partner');
});
test('all nonterminal statuses block a second checkout', () => {
  for (const status of ['active','trialing','past_due','unpaid','incomplete','paused']) assert.equal(blocksCheckout({status}), true);
  for (const status of ['canceled','incomplete_expired']) assert.equal(blocksCheckout({status}), false);
});
test('production, live keys, and a production frontend/backend are rejected before API calls', () => {
  const env = { BILLING_ENABLED:'true', SUPABASE_URL:STAGING_URL, VITE_SUPABASE_URL:STAGING_URL,
    STRIPE_SECRET_KEY: ['rk','test',randomUUID()].join('_'), SUPABASE_SERVICE_ROLE_KEY: randomUUID(), BILLING_APP_URL:'https://close-relax-test.vercel.app' };
  assert.equal(configuration(env).origin, env.BILLING_APP_URL);
  for (const override of [{BILLING_ENABLED:'false'}, {VERCEL_ENV:'production'}, {STRIPE_SECRET_KEY:['rk','live',randomUUID()].join('_')},
    {SUPABASE_URL:'https://production.example'}, {VITE_SUPABASE_URL:'https://production.example'}]) assert.throws(() => configuration({...env,...override}));
});
export const now = Date.parse('2026-11-12T00:00:00Z');
export function paidInvoice(price = CATALOG.core.founding, start = now / 1000 - 1000, end = now / 1000 + 1000) {
  return { status:'paid', livemode:false, lines:{data:[{ quantity:1, amount:1900,
    parent:{subscription_item_details:{subscription:'sub_test',proration:false}},
    pricing:{price_details:{price}}, period:{start,end} }]} };
}
test('paid invoice lines alone establish access; unpaid, unknown prices and future terms do not', () => {
  assert.equal(paidEntitlement([paidInvoice()], 'sub_test', now).paid_tier, 'pro');
  assert.equal(paidEntitlement([{...paidInvoice(),status:'open'}], 'sub_test', now), null);
  assert.equal(paidEntitlement([paidInvoice('price_unknown')], 'sub_test', now), null);
  assert.equal(paidEntitlement([paidInvoice()], 'sub_other', now), null);
  assert.equal(paidEntitlement([paidInvoice(CATALOG.pro.founding, now/1000+1)], 'sub_test', now), null);
});
test('paid upgrade beats older paid Core invoice regardless of arrival order', () => {
  const core = paidInvoice();
  const pro = paidInvoice(CATALOG.pro.founding, now/1000-100);
  pro.lines.data[0].parent.subscription_item_details.proration=true;
  assert.equal(paidEntitlement([pro,core], 'sub_test', now).paid_tier, 'premier');
  assert.equal(paidEntitlement([core,pro], 'sub_test', now).paid_tier, 'premier');
});
test('real sandbox invoice fixtures grant the purchased tiers, including paid prorations', async () => {
  const fixtures=JSON.parse(await readFile(new URL('./fixtures/stripe-paid-invoices.json', import.meta.url),'utf8'));
  for (const fixture of fixtures) {
    const time=fixture.invoice.lines.data.find(l=>l.amount>0).period.start*1000;
    const entitlement=paidEntitlement([fixture.invoice],fixture.subscription,time,fixture.currentPrice);
    assert.equal(entitlement.paid_tier,fixture.currentPrice===CATALOG.pro.regular?'premier':'pro');
  }
});
