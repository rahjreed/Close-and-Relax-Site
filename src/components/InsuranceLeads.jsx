import React, { useEffect, useRef, useState } from 'react';
import { INSURANCE_TYPES } from '../lib/gooseheadLeads';
import { supabase } from '../lib/supabase';
import {
  INSURANCE_LEAD_STATUSES,
  isPlatformAdmin,
  loadInsuranceLeads,
  updateInsuranceLeadStatus,
} from '../lib/insuranceLeads';

export default function InsuranceLeads({ userId, accessToken }) {
  const [allowed, setAllowed] = useState(false);
  const [leads, setLeads] = useState([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState('');
  const generation = useRef(0);

  useEffect(() => {
    const current = ++generation.current;
    let cancelled = false;
    setAllowed(false);
    setLeads([]);
    setOffset(0);
    setError('');
    setSaving(null);
    setLoading(false);
    if (!userId) return;
    (async () => {
      if (!(await isPlatformAdmin(supabase)) || cancelled) return;
      setAllowed(true);
      setLoading(true);
      try {
        const rows = await loadInsuranceLeads(supabase);
        if (!cancelled) setLeads(rows);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (generation.current === current) generation.current++;
    };
  }, [userId, accessToken]);

  const loadPage = async (nextOffset) => {
    const current = generation.current;
    setLoading(true);
    setError('');
    setLeads([]);
    try {
      const rows = await loadInsuranceLeads(supabase, nextOffset);
      if (current === generation.current) {
        setLeads(rows);
        setOffset(nextOffset);
      }
    } catch (err) {
      if (current === generation.current) setError(err.message);
    } finally {
      if (current === generation.current) setLoading(false);
    }
  };
  const saveStatus = async (id, status) => {
    const current = generation.current;
    setSaving(id);
    setError('');
    try {
      await updateInsuranceLeadStatus(supabase, id, status);
      if (current === generation.current)
        setLeads((rows) => rows.map((row) => (row.id === id ? { ...row, status } : row)));
    } catch (err) {
      if (current === generation.current) {
        setLeads([]);
        setError(err.message);
      }
    } finally {
      if (current === generation.current) setSaving(null);
    }
  };

  if (!allowed) return null;
  return (
    <section
      aria-labelledby="insurance-leads-title"
      className="bg-[#EEE8E0] p-6 rounded-2xl border border-[#D4CBC0] md:col-span-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3
          id="insurance-leads-title"
          className="font-editorial text-xl font-bold text-charcoal-deep"
        >
          Insurance Leads
        </h3>
        <button
          type="button"
          onClick={() => loadPage(0)}
          disabled={loading || !!saving}
          className="min-h-[44px] px-3 text-sm underline disabled:opacity-50"
        >
          Refresh newest
        </button>
      </div>
      <p className="text-xs text-charcoal-muted mt-2">
        Private Goosehead requests · Platform administrators only · Newest first
      </p>
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status" className="mt-4 text-sm">
          Loading leads…
        </p>
      ) : (
        !error &&
        leads.length === 0 && (
          <p className="mt-4 text-sm text-charcoal-muted">No insurance leads on this page.</p>
        )
      )}
      <div className="mt-4 space-y-4">
        {leads.map((lead) => (
          <article
            key={lead.id}
            className="bg-white p-4 rounded-xl border border-[#D4CBC0] break-words"
          >
            <h4 className="font-bold text-charcoal-deep">{lead.full_name}</h4>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
              {[
                ['Phone', lead.phone],
                ['Email', lead.email],
                [
                  'Coverage requested',
                  INSURANCE_TYPES.find((item) => item.value === lead.insurance_type)?.label ||
                    'Home insurance',
                ],
                ['Property address', lead.address || 'Not provided (auto only)'],
                [
                  'Callback',
                  `${lead.callback_date} · ${lead.callback_window} (${lead.callback_timezone})`,
                ],
                ['Submitted', new Date(lead.created_at).toLocaleString()],
                [
                  'Referring Realtor',
                  lead.referring_realtor_name ||
                    (lead.profile_id ? 'Name unavailable' : 'Direct request'),
                ],
                ['Realtor profile ID', lead.profile_id || 'Direct request / profile unavailable'],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-charcoal-muted">{label}</dt>
                  <dd className="mt-1 whitespace-pre-wrap">{value}</dd>
                </div>
              ))}
            </dl>
            <label className="mt-4 flex flex-wrap items-center gap-3 text-sm font-semibold">
              Lead status
              <select
                aria-label={`Status for ${lead.full_name}`}
                value={lead.status}
                onChange={(event) => saveStatus(lead.id, event.target.value)}
                disabled={!!saving || loading}
                className="min-h-[44px] rounded-lg border border-[#D4CBC0] bg-white px-3 font-normal"
              >
                {INSURANCE_LEAD_STATUSES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              {saving === lead.id && <span role="status">Saving…</span>}
            </label>
          </article>
        ))}
      </div>
      <div className="flex gap-4 mt-4 text-sm">
        <button
          type="button"
          disabled={offset === 0 || loading || !!saving}
          onClick={() => loadPage(Math.max(0, offset - 50))}
          className="min-h-[44px] underline disabled:opacity-40"
        >
          Newer
        </button>
        <button
          type="button"
          disabled={leads.length < 50 || loading || !!saving}
          onClick={() => loadPage(offset + 50)}
          className="min-h-[44px] underline disabled:opacity-40"
        >
          Older
        </button>
      </div>
    </section>
  );
}
