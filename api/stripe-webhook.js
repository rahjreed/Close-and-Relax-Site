import { clients, result, withAccount, reconcile, save } from '../server/billing.js';

export const config = { api: { bodyParser: false } };
const lifecycle = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded',
  'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted',
  'invoice.paid', 'invoice.payment_failed', 'invoice.payment_action_required', 'invoice.finalization_failed']);
const riskEvents = new Set(['charge.dispute.created', 'charge.refunded', 'radar.early_fraud_warning.created']);

export async function rawBody(req) {
  const chunks = []; let length = 0;
  for await (const chunk of req) {
    length += Buffer.byteLength(chunk);
    if (length > 1024 * 1024) throw new Error('Webhook too large');
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
export function createWebhookHandler(makeClients = clients) {
return async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  let ctx, event;
  try {
    ctx = makeClients();
    if (!process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).end();
  } catch { return res.status(503).end(); }
  try {
    event = ctx.stripe.webhooks.constructEvent(await rawBody(req), req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
    if (event.livemode || event.account) return res.status(400).end();
  } catch { return res.status(400).json({ error: 'Invalid webhook signature.' }); }
  if (!lifecycle.has(event.type) && !riskEvents.has(event.type)) return res.status(200).json({ ignored: true });
  try {
    let customer = event.data.object.customer;
    if (riskEvents.has(event.type)) {
      const obj = event.data.object;
      const charge = event.type === 'charge.refunded' ? obj : await ctx.stripe.charges.retrieve(typeof obj.charge === 'string' ? obj.charge : obj.charge.id);
      // Full refunds, disputes and fraud warnings require a manual billing review.
      if (event.type === 'charge.refunded' && !charge.refunded) return res.status(200).json({ ignored: true });
      customer = charge.customer;
    }
    const customerId = typeof customer === 'string' ? customer : customer?.id;
    if (!customerId) return res.status(200).json({ ignored: true });
    const row = await result(ctx.db.from('billing_accounts').select('user_id').eq('customer_id', customerId).maybeSingle());
    if (!row) {
      // A checkout cannot begin until customer ownership is persisted. Unknown
      // customers belong to other uses of this sandbox and grant no app access.
      return res.status(200).json({ ignored: true });
    }
    await withAccount(ctx.db, row.user_id, async (account, token) => {
      const duplicate = await result(ctx.db.from('billing_events').select('event_id').eq('event_id', event.id).maybeSingle());
      if (duplicate) return;
      if (riskEvents.has(event.type)) await save(ctx.db, account, token, { risk_hold: true }, event.id);
      else await reconcile(ctx, account, token, event.id);
    });
    return res.status(200).json({ received: true });
  } catch {
    // A failed transaction or occupied lease must be retried by Stripe.
    return res.status(503).json({ error: 'Webhook processing will be retried.' });
  }
};
}
export default createWebhookHandler();
