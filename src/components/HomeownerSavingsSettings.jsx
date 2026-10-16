import React, { useState } from 'react';
import { Gift, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  canHideHomeownerSavings,
  shouldShowHomeownerSavings,
  saveHomeownerSavingsVisibility,
} from '../lib/homeownerSavings';

export default function HomeownerSavingsSettings({ profile, onProfileUpdated }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const canHide = canHideHomeownerSavings(profile?.plan);
  const visible = shouldShowHomeownerSavings(profile);
  const save = async (event) => {
    const nextVisible = event.target.checked;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await saveHomeownerSavingsVisibility(supabase, profile, nextVisible);
      onProfileUpdated(updated);
      setMessage(
        shouldShowHomeownerSavings(updated)
          ? 'Homeowner Savings is shown on your hub.'
          : 'Homeowner Savings is hidden on your hub.',
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <section
      aria-labelledby="savings-settings-title"
      className="bg-[#EEE8E0] p-6 rounded-2xl border border-[#D4CBC0] md:col-span-2"
    >
      <div className="flex items-center gap-2">
        <Gift className="w-5 h-5 text-gold-accent" aria-hidden="true" />
        <h3
          id="savings-settings-title"
          className="font-editorial text-xl font-bold text-charcoal-deep"
        >
          Homeowner Savings
        </h3>
      </div>
      <p className="text-xs text-charcoal-muted leading-relaxed mt-3">
        Included automatically on every hub: Vivint Home Security and Goosehead Homeowners
        Insurance. Close &amp; Relax manages the offers and provider links. They are separate from
        your Preferred Vendors and Emergency &amp; Urgent Services, and do not use vendor slots.
      </p>
      {canHide ? (
        <label className="mt-4 inline-flex min-h-[44px] items-center gap-3 text-sm text-charcoal-deep">
          <input
            type="checkbox"
            checked={visible}
            onChange={save}
            disabled={saving}
            className="w-4 h-4"
          />
          {saving ? 'Saving…' : 'Show Homeowner Savings on my hub'}
        </label>
      ) : (
        <p className="flex items-center gap-2 text-xs font-semibold text-charcoal-deep mt-4">
          <Lock className="w-4 h-4 shrink-0" aria-hidden="true" />
          Included and always shown on Free and Core. Pro can hide or show the entire section.
        </p>
      )}
      <p className="text-[11px] text-charcoal-muted mt-2">
        Individual offers are managed by Close &amp; Relax.
      </p>
      {error && (
        <p role="alert" className="text-xs text-red-700 mt-3">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-xs text-emerald-700 mt-3">
          {message}
        </p>
      )}
    </section>
  );
}
