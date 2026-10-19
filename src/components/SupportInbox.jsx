import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { isPlatformAdmin } from '../lib/insuranceLeads';

export default function SupportInbox({ userId, accessToken }) {
  const [allowed, setAllowed] = useState(false), [rows, setRows] = useState([]);
  const [offset, setOffset] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    setAllowed(false); setRows([]); setOffset(0); setError(''); setBusy(false);
    if (userId) isPlatformAdmin(supabase).then((yes) => {
      if (current !== generation.current || !yes) return;
      setAllowed(true); load(0, current);
    });
    return () => { generation.current++; };
  }, [userId, accessToken]);
  async function load(nextOffset, current = generation.current) {
    setBusy(true); setError(''); setRows([]);
    try {
      const { data, error: failure } = await supabase.rpc('list_support_messages', { page_offset: nextOffset });
      if (failure || !Array.isArray(data)) throw new Error();
      if (current === generation.current) { setRows(data); setOffset(nextOffset); }
    } catch { if (current === generation.current) setError('Unable to load support messages. Check admin access and refresh.'); }
    finally { if (current === generation.current) setBusy(false); }
  }
  async function changeStatus(id, status) {
    const current = generation.current;
    setBusy(true); setError('');
    try {
      const { data, error: failure } = await supabase.rpc('update_support_message_status', { message_id: id, new_status: status });
      if (failure || data !== status) throw new Error();
      if (current === generation.current) setRows((old) => old.map((row) => row.id === id ? { ...row, status } : row));
    } catch { if (current === generation.current) { setRows([]); setError('Status was not confirmed. Refresh and try again.'); } }
    finally { if (current === generation.current) setBusy(false); }
  }
  if (!allowed) return null;
  return <section aria-labelledby="support-inbox-title" className="bg-[#EEE8E0] p-6 rounded-2xl border border-[#D4CBC0] md:col-span-2">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 id="support-inbox-title" className="font-editorial text-xl font-bold text-charcoal-deep">Support Inbox</h3>
      <button type="button" disabled={busy} onClick={() => load(0)} className="min-h-[44px] text-sm underline disabled:opacity-50">Refresh newest</button>
    </div>
    <p className="text-xs text-charcoal-muted mt-2">Platform administrators only · Newest first · Check this inbox regularly. No email alerts are sent.</p>
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    {busy && <p role="status" className="mt-4 text-sm">Loading / saving…</p>}
    {!busy && !error && !rows.length && <p className="mt-4 text-sm text-charcoal-muted">No support messages on this page.</p>}
    <div className="mt-4 space-y-4">{rows.map((row) => <article key={row.id} className="bg-white p-4 rounded-xl border border-[#D4CBC0] break-words">
      <h4 className="font-bold text-charcoal-deep">{row.name}</h4>
      <p className="text-sm mt-2">{row.email}</p>
      <p className="text-xs text-charcoal-muted mt-2">{new Date(row.created_at).toLocaleString()} · Reference: {row.id}</p>
      <p className="mt-4 text-sm whitespace-pre-wrap">{row.message}</p>
      <a className="inline-flex items-center min-h-[44px] text-sm underline mt-2" href={`mailto:${encodeURIComponent(row.email)}?subject=${encodeURIComponent(`Close & Relax support — ${row.id}`)}`}>Reply in email app</a>
      <label className="flex flex-wrap items-center gap-3 text-sm mt-2">Status
        <select aria-label={`Support status for ${row.name}`} value={row.status} disabled={busy} onChange={(e) => changeStatus(row.id, e.target.value)} className="min-h-[44px] rounded-lg border border-[#D4CBC0] bg-white px-3">
          <option value="new">New</option><option value="in_progress">In progress</option><option value="closed">Closed</option>
        </select>
      </label>
    </article>)}</div>
    <div className="flex gap-4 mt-4 text-sm">
      <button type="button" disabled={busy || offset === 0} onClick={() => load(Math.max(0, offset - 50))} className="min-h-[44px] underline disabled:opacity-40">Newer</button>
      <button type="button" disabled={busy || rows.length < 50} onClick={() => load(offset + 50)} className="min-h-[44px] underline disabled:opacity-40">Older</button>
    </div>
  </section>;
}
