import React, { useEffect, useState } from 'react';
import { defaultReminderPreferences, disableHomeReminders, enableHomeReminders, loadReminderState, pushSupport } from '../lib/homeownerPush.js';

const labels = { hvac: 'HVAC / Filter Reminder', monthly: 'Monthly Home Maintenance', seasonal: 'Seasonal Home Maintenance' };
export default function HomeownerReminderSettings({ profileId, preview = false }) {
  const [open, setOpen] = useState(false), [preferences, setPreferences] = useState(defaultReminderPreferences);
  const [status, setStatus] = useState('off'), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const support = preview ? 'preview' : pushSupport();
  useEffect(() => {
    if (preview || support !== 'supported') return;
    let cancelled = false;
    const refresh = () => loadReminderState(profileId).then(result => {
      if (cancelled || !result) return;
      setStatus(result.status);
      if (result.preferences) setPreferences(result.preferences);
    }).catch(() => { if (!cancelled) setMessage('Could not check reminder settings. Open settings to retry.'); });
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    refresh(); document.addEventListener('visibilitychange', visible);
    navigator.serviceWorker.addEventListener('message', refresh);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', visible); navigator.serviceWorker.removeEventListener('message', refresh); };
  }, [profileId, preview, support, open]);
  const edit = (kind, patch) => setPreferences(p => ({ ...p, reminders: p.reminders.map(r => r.kind === kind ? { ...r, ...patch } : r) }));
  const save = async event => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const result = await enableHomeReminders(profileId, preferences, { preview }); setStatus(result.status);
      setMessage(result.status === 'active' ? 'Your reminder settings are saved.' : 'Confirming this browser’s subscription. A welcome notification will appear; recurring reminders start after confirmation.');
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };
  const off = async () => {
    setBusy(true);
    try { await disableHomeReminders(profileId, { preview }); setStatus('off'); setMessage('All reminders are off for this installation.'); }
    catch { setStatus('off'); setMessage('Browser notifications are off. Server removal is pending; reopen this hub online to finish.'); }
    finally { setBusy(false); }
  };
  const field = 'w-full rounded-lg border border-[#d9cbb8] bg-white px-3 py-2 text-sm text-[#1c1917]';
  return <section id="home-reminders" className="bg-[#f5efe5] rounded-2xl border border-[#ebdcc7] p-4 sm:p-5 mb-6" aria-labelledby="home-reminders-title">
    <div className="flex items-start justify-between gap-3">
      <div><h2 id="home-reminders-title" className="text-base font-semibold">Home Reminders</h2>
        <p className="text-xs text-[#78716c] mt-1">Helpful reminders for your home, on your schedule. Choose what you receive. Turn them off anytime.</p></div>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="text-xs font-semibold underline shrink-0 py-2 min-h-[44px] min-w-[44px]">{open ? 'Close' : 'Settings'}</button>
    </div>
    {open && <div className="mt-4">
      {support === 'preview' && <p className="text-sm">Homeowners can choose reminders here. Notifications and saved preferences are disabled in private preview.</p>}
      {support === 'install-ios' && <p className="text-sm">On iPhone or iPad, use Share → Add to Home Screen, open this hub from its new icon, then return here to enable reminders. Requires a supported iOS/iPadOS version (16.4 or later).</p>}
      {support === 'unsupported' && <p className="text-sm">Push reminders are unavailable in this browser. Your hub and checklist still work normally.</p>}
      {support === 'supported' && <form onSubmit={save} className="space-y-4">
        <fieldset disabled={busy} className="space-y-3"><legend className="text-sm font-medium mb-2">Choose your reminders</legend>
          {preferences.reminders.map(r => <div key={r.kind}><label className="flex gap-3 items-center text-sm py-1 min-h-[44px]"><input type="checkbox" checked={r.enabled} onChange={e => edit(r.kind, { enabled: e.target.checked })} />{labels[r.kind]}</label>
            {r.kind === 'hvac' && r.enabled && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 pl-6">
              <label className="text-xs">First reminder date<input aria-label="First HVAC reminder date" className={field} type="date" required value={r.first_date || ''} onChange={e => edit('hvac', { first_date: e.target.value })} /></label>
              <label className="text-xs">Repeat every (days)<input className={field} type="number" inputMode="numeric" min="7" max="730" required value={r.interval_days || 90} onChange={e => edit('hvac', { interval_days: Number(e.target.value) })} /></label>
            </div>}{r.kind === 'hvac' && r.enabled && <p className="text-xs text-[#78716c] pl-6 mt-2">Uses the next occurrence at your chosen delivery time. Choose an interval that fits your filter’s maintenance instructions.</p>}</div>)}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs">Timezone<input className={field} required value={preferences.timezone} list="home-reminder-timezones" onChange={e => setPreferences(p => ({ ...p, timezone: e.target.value }))} /><datalist id="home-reminder-timezones">{['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Indiana/Indianapolis','Pacific/Honolulu','UTC'].map(z => <option key={z} value={z} />)}</datalist></label>
            <label className="text-xs">Delivery time<input className={field} type="time" min="09:00" max="19:00" required value={preferences.delivery_time} onChange={e => setPreferences(p => ({ ...p, delivery_time: e.target.value }))} /></label>
          </div>
        </fieldset>
        <p className="text-xs text-[#78716c] leading-relaxed">Applies only to this browser/PWA installation. At most one reminder per day and two per week. Coinciding reminders may be combined. These schedules are independent of your checklist; checking off an item does not reset them. Delivery can be delayed by device settings or connectivity.</p>
        <p className="text-xs text-[#78716c]">By enabling reminders, you agree to store this installation’s push subscription and selected schedules. No homeowner account is needed.</p>
        <div className="flex flex-wrap gap-3"><button type="submit" disabled={busy || !preferences.reminders.some(r => r.enabled) && status === 'off'} className="rounded-lg px-4 py-2.5 min-h-[44px] bg-[#1c1917] text-white text-sm disabled:opacity-50">{busy ? 'Please wait…' : status === 'active' ? 'Save preferences' : 'Enable reminders'}</button>
          <button type="button" disabled={busy} onClick={off} className="text-xs underline py-2 min-h-[44px]">Turn off all reminders</button></div>
        {status === 'active' && <p className="text-xs font-semibold">Reminders are enabled.</p>}
      </form>}
      {message && <p className="mt-3 text-sm" role="status">{message}</p>}
    </div>}
  </section>;
}
