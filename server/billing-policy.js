// Public plan names deliberately differ from the legacy database names.
export const STAGING_URL = 'https://amopxaadnvubvveqpkvu.supabase.co';
export const STRIPE_ACCOUNT = 'acct_1USR2SEvcTt943uR';
// Match the date/time zone already advertised by the application (Eastern time).
export const FOUNDING_END = Date.parse('2027-01-18T23:59:59-05:00');
export const CATALOG = Object.freeze({
  core: { tier: 'pro', regular: 'price_1UambGEvcTt943uRCLAfS56N', founding: 'price_1UambIEvcTt943uR8W6MtdQ2', amount: 2900, foundingAmount: 1900 },
  pro: { tier: 'premier', regular: 'price_1UambJEvcTt943uR5KlvCFwX', founding: 'price_1UambLEvcTt943uRciOJel0B', amount: 3900, foundingAmount: 2900 },
});
export function priceInfo(id) {
  for (const [plan, entry] of Object.entries(CATALOG)) {
    if (id === entry.regular || id === entry.founding) return { plan, tier: entry.tier, founding: id === entry.founding };
  }
  return null;
}
export function checkoutPrice(plan, hasSubscribed, now = Date.now()) {
  if (!Object.hasOwn(CATALOG, plan)) throw new Error('Choose Core or Pro.');
  return CATALOG[plan][!hasSubscribed && now <= FOUNDING_END ? 'founding' : 'regular'];
}
export const blocksCheckout = (sub) => !['canceled', 'incomplete_expired'].includes(sub.status);
export const effectiveTier = (row, now = Date.now()) =>
  !row?.risk_hold && Date.parse(row?.paid_through || '') > now ? row.paid_tier : 'partner';

// Only an actually paid recurring invoice line extends entitlement. An unpaid
// upgrade must never replace the previously purchased tier or extend its term.
export function paidEntitlement(invoices, subscriptionId, now = Date.now(), currentPrice = null) {
  const candidates = [];
  for (const invoice of invoices) {
    if (invoice.status !== 'paid' || invoice.livemode) continue;
    for (const line of invoice.lines.data) {
      const parent = line.parent?.subscription_item_details;
      const price = line.pricing?.price_details?.price;
      const info = priceInfo(typeof price === 'string' ? price : price?.id);
      const subscription = parent?.subscription;
      if (!info || subscription !== subscriptionId || line.amount < 0 || line.quantity !== 1) continue;
      if (line.period.start * 1000 > now || line.period.end * 1000 <= now) continue;
      candidates.push({ paid_tier: info.tier, paid_through: new Date(line.period.end * 1000).toISOString(), start: line.period.start,
        current: (typeof price === 'string' ? price : price?.id) === currentPrice, invoiceCreated: invoice.created || 0 });
    }
  }
  // Latest purchased period wins, even when invoices arrive out of order.
  candidates.sort((a, b) => b.start - a.start || b.invoiceCreated - a.invoiceCreated || Number(b.current) - Number(a.current));
  return candidates[0] || null;
}
