import React, { useEffect, useRef, useState } from 'react';
import { billingRequest } from '../lib/billing';

export default function BillingControls({ userId, onRefresh }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const refresh = useRef(onRefresh);
  refresh.current = onRefresh;
  useEffect(() => {
    let stopped = false;
    let polls = 0;
    const load = async () => {
      try {
        const next = await billingRequest('status');
        if (!stopped) { setStatus(next); setError(''); await refresh.current?.(); }
      } catch (err) { if (!stopped) setError(err.message); }
      finally { if (!stopped) setLoading(false); }
    };
    void load();
    // Checkout return is informational. Only the webhook changes paid access.
    const timer = setInterval(() => { if (++polls < 12) void load(); else clearInterval(timer); }, 5000);
    return () => { stopped = true; clearInterval(timer); };
  }, [userId]);
  const open = async (action, plan) => {
    setBusy(true); setError('');
    try {
      const response = await billingRequest(action, plan);
      const url = new URL(response.url);
      if (url.protocol !== 'https:' || !['checkout.stripe.com', 'billing.stripe.com'].includes(url.hostname)) throw new Error('Invalid billing destination.');
      window.location.assign(url.href);
    } catch (err) { setError(err.message); setBusy(false); }
  };
  const subscribed = status && !['none', 'canceled', 'incomplete_expired'].includes(status.status);
  return <div className="mt-4 text-xs text-charcoal-muted" aria-busy={busy || loading}>
    <p>Monthly plans renew automatically. Prices exclude applicable tax.</p>
    {new URLSearchParams(window.location.search).get('billing') === 'processing' && <p role="status" className="mt-2">Checkout received. Access updates after payment is verified. This can take a moment.</p>}
    {status && <p className="mt-2">Billing: {status.status.replaceAll('_', ' ')}{status.founding ? ' · Founding member' : ''}
      {status.paidThrough ? ` · ${status.cancelAtPeriodEnd ? 'Access ends' : 'Paid through'} ${new Date(status.paidThrough).toLocaleDateString()}` : ''}</p>}
    {status?.status === 'past_due' && <p role="alert" className="mt-2">Your payment needs attention. Update your payment method in Manage billing. Paid access lasts through the paid-through date.</p>}
    <div className="flex flex-wrap gap-3 mt-3">
      {!subscribed && ['core', 'pro'].map(plan => <button key={plan} disabled={busy || loading || !status} onClick={() => open('checkout', plan)} className="px-4 py-2 rounded-lg border border-[#D4CBC0] bg-[#FCFAF6] font-semibold text-charcoal-deep disabled:opacity-50">
        Choose {plan === 'core' ? 'Core' : 'Pro'} · ${plan === 'core' ? (status?.foundingEligible ? 19 : 29) : (status?.foundingEligible ? 29 : 39)}/month
      </button>)}
      {status?.hasCustomer && <button disabled={busy} onClick={() => open('portal')} className="px-4 py-2 rounded-lg border border-[#D4CBC0] bg-[#FCFAF6] font-semibold text-charcoal-deep disabled:opacity-50">Manage billing</button>}
    </div>
    {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
    <p className="mt-2">Change plans, update payment methods, or cancel in the Stripe billing portal. Cancellations take effect at the end of your billing period.</p>
  </div>;
}
