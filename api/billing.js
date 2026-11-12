import { clients, result, withAccount, checkout, portal, summary, BillingError } from '../server/billing.js';

export function createBillingHandler(makeClients = clients) {
return async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const ctx = makeClients();
    if (req.method !== 'POST') throw new BillingError(405, 'Use POST.');
    if (req.headers.origin !== ctx.origin) throw new BillingError(403, 'Unrecognized billing origin.');
    const token = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1];
    if (!token) throw new BillingError(401, 'Please sign in.');
    const { data, error } = await ctx.db.auth.getUser(token);
    if (error || !data.user || data.user.is_anonymous) throw new BillingError(401, 'Please sign in again.');
    const user = data.user;
    const profile = await result(ctx.db.from('profiles').select('id').eq('id', user.id).maybeSingle());
    if (!profile) throw new BillingError(409, 'Your profile is still being created. Try again shortly.');
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body || Object.keys(body).some(k => !['action', 'plan'].includes(k))) throw new BillingError(400, 'Invalid billing request.');
    if (body.action === 'status') {
      const row = await result(ctx.db.from('billing_accounts').select('*').eq('user_id', user.id).maybeSingle());
      return res.status(200).json(summary(row));
    }
    if (!['checkout', 'portal'].includes(body.action)) throw new BillingError(400, 'Invalid billing action.');
    const response = await withAccount(ctx.db, user.id, async (row, lease) =>
      body.action === 'checkout' ? checkout(ctx, row, lease, body.plan, user) : portal(ctx, row));
    return res.status(200).json(response);
  } catch (error) {
    // Deliberately exclude provider errors, request bodies, tokens and PII.
    return res.status(error instanceof BillingError ? error.status : 503).json({ error: error instanceof BillingError ? error.message : 'Billing is temporarily unavailable. Please try again.' });
  }
};
}
export default createBillingHandler();
