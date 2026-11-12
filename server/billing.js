import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { CATALOG, STAGING_URL, STRIPE_ACCOUNT, checkoutPrice, priceInfo, blocksCheckout, effectiveTier, paidEntitlement, FOUNDING_END } from './billing-policy.js';

export class BillingError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function configuration(env = process.env) {
  if (env.BILLING_ENABLED !== 'true') throw new BillingError(503, 'Billing is not configured yet.');
  if (env.VERCEL_ENV === 'production' || env.SUPABASE_URL !== STAGING_URL || env.VITE_SUPABASE_URL !== STAGING_URL ||
      !/^(sk|rk)_test_/.test(env.STRIPE_SECRET_KEY || '') || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new BillingError(503, 'Staging billing configuration is invalid.');
  }
  const origin = new URL(env.BILLING_APP_URL).origin;
  if (!env.BILLING_APP_URL.startsWith('https://') && !origin.startsWith('http://localhost:')) throw new BillingError(503, 'Invalid billing origin.');
  return { origin };
}
export function clients() {
  const config = configuration();
  return {
    ...config,
    stripe: new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-09-30.endive', maxNetworkRetries: 2, timeout: 20000 }),
    db: createClient(STAGING_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }),
  };
}
export async function result(query) {
  const { data, error } = await query;
  if (error) throw new BillingError(503, 'Billing storage is unavailable.');
  return data;
}
export async function withAccount(db, userId, run) {
  const token = randomUUID();
  const account = await result(db.rpc('billing_acquire', { account_user: userId, lease_token: token }));
  if (!account) throw new BillingError(409, 'Billing is busy. Please try again shortly.');
  try { return await run(account, token); }
  finally { await result(db.rpc('billing_release', { account_user: userId, lease_token: token })); }
}
export const save = (db, row, token, patch, eventId = null) => result(db.rpc('billing_save', {
  account_user: row.user_id, lease_token: token, changes: patch, stripe_event: eventId,
}));

export async function verifyCatalog(stripe) {
  const account = await stripe.accounts.retrieve();
  if (account.id !== STRIPE_ACCOUNT) throw new BillingError(503, 'Wrong Stripe sandbox.');
  for (const entry of Object.values(CATALOG)) {
    for (const rate of ['regular', 'founding']) {
      const p = await stripe.prices.retrieve(entry[rate]);
      if (p.livemode || !p.active || p.currency !== 'usd' || p.recurring?.interval !== 'month' || p.recurring.interval_count !== 1 ||
          p.tax_behavior !== 'exclusive' || p.unit_amount !== (rate === 'founding' ? entry.foundingAmount : entry.amount)) {
        throw new BillingError(503, 'Stripe price configuration does not match this application.');
      }
    }
  }
}
export async function subscriptions(stripe, customer) {
  const items = [];
  for await (const sub of stripe.subscriptions.list({ customer, status: 'all', limit: 100 })) items.push(sub);
  if (items.some(s => s.livemode)) throw new BillingError(503, 'Live subscription rejected.');
  return items;
}
export async function checkout(ctx, row, token, plan, user) {
  const { stripe, db, origin } = ctx;
  if (!Object.hasOwn(CATALOG, plan)) throw new BillingError(400, 'Choose Core or Pro.');
  await verifyCatalog(stripe);
  if (!row.customer_id) {
    const customer = await stripe.customers.create({ email: user.email }, { idempotencyKey: `close-relax-customer-${user.id}` });
    row.customer_id = customer.id;
    await save(db, row, token, { customer_id: customer.id });
  }
  const subs = await subscriptions(stripe, row.customer_id);
  if (subs.some(blocksCheckout)) throw new BillingError(409, 'You already have a subscription. Use Manage billing to change it.');
  const hasSubscribed = row.has_subscribed || subs.some(s => s.status !== 'incomplete_expired');
  let attempt = row.checkout_attempt;
  // A persisted attempt closes the crash window between Stripe creation and DB save.
  // Retry the SAME price, expiry and idempotency key after ambiguous failures.
  if (attempt && attempt.expires_at * 1000 > Date.now()) {
    if (attempt.plan !== plan) throw new BillingError(409, 'An existing checkout is pending. Finish it or wait 30 minutes before choosing another plan.');
  } else {
    const price = checkoutPrice(plan, hasSubscribed);
    // Eligibility is reserved server-side at signup, with a 31-minute checkout
    // window (Stripe requires sessions to expire at least 30 minutes out).
    attempt = { key: randomUUID(), plan, price, expires_at: Math.floor(Date.now() / 1000) + 1860 };
    await save(db, row, token, { checkout_attempt: attempt });
  }
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription', customer: row.customer_id, client_reference_id: user.id,
    line_items: [{ price: attempt.price, quantity: 1 }],
    automatic_tax: { enabled: true }, billing_address_collection: 'required',
    customer_update: { address: 'auto', name: 'auto' }, tax_id_collection: { enabled: true },
    subscription_data: { billing_mode: { type: 'flexible' } },
    integration_identifier: 'close_relax_staging_abcdwxyz',
    expires_at: attempt.expires_at,
    success_url: `${origin}/dashboard?billing=processing`, cancel_url: `${origin}/dashboard?billing=canceled`,
  }, { idempotencyKey: `checkout-${attempt.key}` });
  if (session.status !== 'open' || !session.url) throw new BillingError(409, 'Checkout has finished. Billing is syncing; refresh shortly.');
  return { url: session.url };
}

export async function portal(ctx, row) {
  if (!row.customer_id) throw new BillingError(409, 'Choose a paid plan first.');
  const subs = await subscriptions(ctx.stripe, row.customer_id);
  const current = subs.find(blocksCheckout);
  const founding = current?.items.data.some(item => priceInfo(item.price.id)?.founding);
  const configId = founding ? process.env.STRIPE_PORTAL_FOUNDING_CONFIG : process.env.STRIPE_PORTAL_REGULAR_CONFIG;
  if (!configId) throw new BillingError(503, 'Billing portal configuration is missing.');
  // Never accept a portal configuration from the browser. Validate its price
  // allowlist on every visit so regular subscribers cannot acquire founding prices.
  const config = await ctx.stripe.billingPortal.configurations.retrieve(configId, { expand: ['features.subscription_update.products'] });
  const update = config.features.subscription_update;
  const allowed = Object.values(CATALOG).map(p => p[founding ? 'founding' : 'regular']);
  const configured = (update.products || []).flatMap(p => p.prices);
  if (!config.active || config.livemode || !update.enabled || configured.length !== 2 ||
      !allowed.every(p => configured.includes(p)) || update.default_allowed_updates?.some(v => v !== 'price') ||
      config.features.subscription_cancel.mode !== 'at_period_end' || !config.features.subscription_cancel.enabled ||
      !config.features.payment_method_update.enabled || update.proration_behavior !== 'always_invoice' ||
      !update.schedule_at_period_end?.conditions?.some(c => c.type === 'decreasing_item_amount')) {
    throw new BillingError(503, 'Billing portal settings require review.');
  }
  const session = await ctx.stripe.billingPortal.sessions.create({ customer: row.customer_id, configuration: configId, return_url: `${ctx.origin}/dashboard` });
  return { url: session.url };
}

export async function reconcile(ctx, row, token, eventId) {
  const subs = await subscriptions(ctx.stripe, row.customer_id);
  const active = subs.filter(blocksCheckout);
  if (active.length > 1) throw new BillingError(409, 'Multiple subscriptions require review.');
  const current = active[0] || subs.sort((a, b) => b.created - a.created)[0];
  const invoices = [];
  if (current) {
    for await (const invoice of ctx.stripe.invoices.list({ customer: row.customer_id, subscription: current.id, status: 'paid', limit: 100, expand: ['data.lines'] })) {
      // Avoid silently truncating invoice lines.
      if (invoice.lines.has_more) invoice.lines.data = await ctx.stripe.invoices.listLineItems(invoice.id, { limit: 100 }).autoPagingToArray({ limit: 10000 });
      invoices.push(invoice);
    }
  }
  const entitlement = current && paidEntitlement(invoices, current.id, Date.now(), current.items.data[0]?.price.id);
  const previous = effectiveTier(row) !== 'partner' ? { paid_tier: row.paid_tier, paid_through: row.paid_through } : null;
  await save(ctx.db, row, token, {
    subscription_id: current?.id || null, status: current?.status || 'none',
    price_id: current?.items.data[0]?.price.id || null,
    has_subscribed: row.has_subscribed || subs.some(s => s.status !== 'incomplete_expired'),
    cancel_at_period_end: current?.cancel_at_period_end || false,
    paid_tier: entitlement?.paid_tier || previous?.paid_tier || 'partner', paid_through: entitlement?.paid_through || previous?.paid_through || null,
  }, eventId);
}
export function summary(row) {
  return { tier: effectiveTier(row), status: row?.status || 'none', paidThrough: row?.paid_through || null,
    cancelAtPeriodEnd: row?.cancel_at_period_end || false, hasCustomer: Boolean(row?.customer_id),
    founding: Boolean(priceInfo(row?.price_id)?.founding), foundingEligible: !row?.has_subscribed && Date.now() <= FOUNDING_END };
}
