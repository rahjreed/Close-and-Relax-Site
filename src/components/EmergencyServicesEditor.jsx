import React, { useEffect, useState } from 'react';
import {
  EMERGENCY_CATEGORIES,
  CONFIRMATION_METHODS,
  loadEmergencyServices,
  saveEmergencyAssignment,
  clearEmergencyAssignment,
} from '../lib/emergencyServices';

const emptyForm = () => ({
  provider_name: '',
  phone: '',
  website: '',
  availability_status: 'unknown',
  availability_confirmation_method: '',
});
const inputClass =
  'w-full mt-1 rounded-lg border border-[#D4CBC0] bg-white px-3 py-2 text-sm text-charcoal-deep';

function ProviderForm({ profileId, category, assignment, disabled, onChange }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    setForm({
      ...emptyForm(),
      ...assignment,
      website: assignment?.website || '',
      availability_confirmation_method: assignment?.availability_confirmation_method || '',
    });
  }, [assignment]);
  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage('');
    setError('');
  };
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      onChange(await saveEmergencyAssignment(profileId, category.code, form));
      setMessage('Emergency provider saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };
  const clear = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await clearEmergencyAssignment(profileId, category.code);
      onChange(null);
      setForm(emptyForm());
      setMessage('Provider cleared. This category remains on your hub.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <form onSubmit={save} className="rounded-xl border border-[#D4CBC0] bg-[#FCFAF6] p-4">
      <fieldset disabled={disabled || saving} className="space-y-3">
        <legend className="font-editorial text-xl font-bold text-charcoal-deep mb-2">
          {category.label}
        </legend>
        <label className="block text-xs text-charcoal-muted">
          Provider name
          <input
            required
            maxLength={160}
            value={form.provider_name}
            onChange={(event) => update('provider_name', event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-xs text-charcoal-muted">
          Phone (required)
          <input
            required
            type="tel"
            maxLength={50}
            value={form.phone}
            onChange={(event) => update('phone', event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-xs text-charcoal-muted">
          Website (optional)
          <input
            type="text"
            inputMode="url"
            maxLength={2048}
            placeholder="https://provider.example"
            value={form.website}
            onChange={(event) => update('website', event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex items-start gap-2 text-xs text-charcoal-muted">
          <input
            type="checkbox"
            checked={form.availability_status === 'confirmed_24_7'}
            onChange={(event) => {
              update('availability_status', event.target.checked ? 'confirmed_24_7' : 'unknown');
              if (!event.target.checked) update('availability_confirmation_method', '');
            }}
            className="mt-0.5"
          />
          <span>
            I explicitly confirm this provider offers 24/7 service. Changing the provider’s name,
            phone, or website resets any earlier confirmation; check this again after saving those
            changes.
          </span>
        </label>
        {form.availability_status === 'confirmed_24_7' && (
          <label className="block text-xs text-charcoal-muted">
            How did you confirm?
            <select
              required
              value={form.availability_confirmation_method}
              onChange={(event) => update('availability_confirmation_method', event.target.value)}
              className={inputClass}
            >
              <option value="">Choose a confirmation source</option>
              {CONFIRMATION_METHODS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-[#292524] text-white text-xs font-semibold disabled:opacity-50"
          >
            {saving ? 'Saving…' : assignment ? 'Save provider' : 'Assign provider'}
          </button>
          {assignment && (
            <button
              type="button"
              onClick={clear}
              className="px-4 py-2 rounded-lg border border-[#D4CBC0] text-xs font-semibold text-charcoal-deep"
            >
              Clear provider
            </button>
          )}
        </div>
      </fieldset>
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
    </form>
  );
}

export default function EmergencyServicesEditor({ profileId }) {
  const [data, setData] = useState({
    categories: EMERGENCY_CATEGORIES,
    assignments: [],
    error: null,
  });
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setData({ categories: EMERGENCY_CATEGORIES, assignments: [], error: null });
    loadEmergencyServices(profileId)
      .then((result) => {
        if (current) setData(result);
      })
      .catch(() => {
        if (current)
          setData({
            categories: EMERGENCY_CATEGORIES,
            assignments: [],
            error: 'Unable to load emergency contacts. Please try again.',
          });
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [profileId, retry]);
  return (
    <section
      className="bg-[#EEE8E0] p-6 rounded-2xl border border-[#D4CBC0] md:col-span-2"
      aria-labelledby="emergency-editor-title"
      aria-busy={loading}
    >
      <h3
        id="emergency-editor-title"
        className="font-editorial text-xl font-bold text-charcoal-deep"
      >
        Emergency &amp; Urgent Services
      </h3>
      <p className="text-xs text-charcoal-muted leading-relaxed mt-2 mb-5">
        Included on Free, Core, and Pro. These six categories always appear on your homeowner hub.
        Assignments do not use any of your preferred-vendor slots. Clearing a provider leaves the
        category visible.
      </p>
      {loading && (
        <p role="status" className="text-xs mb-4">
          Loading emergency contacts…
        </p>
      )}
      {data.error && (
        <div role="alert" className="text-xs text-red-700 mb-4">
          <p>{data.error}</p>
          <button
            type="button"
            onClick={() => setRetry((value) => value + 1)}
            className="underline mt-2"
          >
            Retry loading
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data.categories.map((category) => (
          <ProviderForm
            key={`${profileId}-${category.code}`}
            profileId={profileId}
            category={category}
            assignment={data.assignments.find(
              ({ category_code }) => category_code === category.code,
            )}
            disabled={loading || Boolean(data.error) || !profileId}
            onChange={(assignment) =>
              setData((current) => ({
                ...current,
                assignments: [
                  ...current.assignments.filter(
                    ({ category_code }) => category_code !== category.code,
                  ),
                  ...(assignment ? [assignment] : []),
                ],
              }))
            }
          />
        ))}
      </div>
    </section>
  );
}
