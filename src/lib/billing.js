import { supabase } from './supabase';

export async function billingRequest(action, plan) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Please sign in to manage billing.');
  const response = await fetch('/api/billing', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action, ...(plan ? { plan } : {}) }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Billing is temporarily unavailable.');
  return body;
}
