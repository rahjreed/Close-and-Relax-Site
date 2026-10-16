import React, { useEffect, useId, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  CALLBACK_WINDOWS,
  localToday,
  validateGooseheadLead,
  submitGooseheadLead,
} from '../lib/gooseheadLeads';

let captchaReady;
function loadCaptcha() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!captchaReady)
    captchaReady = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(window.turnstile);
      script.onerror = () => {
        captchaReady = null;
        reject(new Error('Verification is unavailable. Please reload and try again.'));
      };
      document.head.appendChild(script);
    });
  return captchaReady;
}

export default function GooseheadLeadForm({
  profileId,
  onClose,
  siteKey = import.meta.env?.VITE_TURNSTILE_SITE_KEY || '',
}) {
  const formId = useId();
  const container = useRef(null);
  const widget = useRef(null);
  const requestId = useRef(null);
  if (!requestId.current) requestId.current = crypto.randomUUID();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    address: '',
    email: '',
    callback_date: localToday(timezone),
    callback_window: '',
    contact_consent: false,
    company_website: '',
  });
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);
  useEffect(() => {
    let current = true;
    if (!siteKey || accepted)
      return () => {
        current = false;
      };
    loadCaptcha()
      .then((api) => {
        if (!current || !container.current) return;
        widget.current = api.render(container.current, {
          sitekey: siteKey,
          action: 'goosehead_lead',
          callback: setToken,
          'expired-callback': () => setToken(''),
          'error-callback': () => {
            setToken('');
            setError('Verification is unavailable. Please try again.');
          },
        });
      })
      .catch(() => {
        if (current) setError('Verification is unavailable. Please reload and try again.');
      });
    return () => {
      current = false;
      if (widget.current !== null && window.turnstile) {
        window.turnstile.remove(widget.current);
        widget.current = null;
      }
    };
  }, [siteKey, accepted]);
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (!siteKey)
        throw new Error('The request form is temporarily unavailable. Please try again later.');
      const lead = validateGooseheadLead({
        ...form,
        profile_id: profileId,
        request_id: requestId.current,
        callback_timezone: timezone,
      });
      await submitGooseheadLead(supabase, lead, token, form.company_website);
      setAccepted(true);
    } catch (err) {
      setError(err.message);
      setToken('');
      if (widget.current !== null && window.turnstile) window.turnstile.reset(widget.current);
    } finally {
      setSaving(false);
    }
  };
  const inputClass =
    'block w-full min-h-[44px] rounded-lg border border-[#c9d7c3] px-3 py-2 mt-1 text-base bg-white text-[#292524]';
  return (
    <div className="mt-4 rounded-xl border border-[#dce5d8] bg-[#f7faf5] p-4">
      <h4 id={`${formId}-title`} className="font-semibold text-sm text-[#292524]">
        Request an insurance review
      </h4>
      {accepted ? (
        <p role="status" className="text-sm text-[#35543a] mt-3">
          Your request has been received. Your preferred callback time has been shared with the
          Close &amp; Relax team.
        </p>
      ) : (
        <form onSubmit={submit} aria-labelledby={`${formId}-title`} className="mt-3 space-y-3">
          <fieldset disabled={saving} className="space-y-3">
            <label className="block text-xs text-[#57534e]">
              Name
              <input
                required
                autoComplete="name"
                maxLength={160}
                value={form.full_name}
                onChange={(e) => update('full_name', e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-xs text-[#57534e]">
              Phone number
              <input
                required
                type="tel"
                autoComplete="tel"
                maxLength={50}
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-xs text-[#57534e]">
              Home address
              <textarea
                required
                autoComplete="street-address"
                maxLength={500}
                rows={3}
                value={form.address}
                onChange={(e) => update('address', e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-xs text-[#57534e]">
              Email address
              <input
                required
                type="email"
                autoComplete="email"
                maxLength={254}
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-xs text-[#57534e]">
              Preferred callback date
              <input
                required
                type="date"
                min={localToday(timezone)}
                value={form.callback_date}
                onChange={(e) => update('callback_date', e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-xs text-[#57534e]">
              Preferred callback window
              <select
                required
                value={form.callback_window}
                onChange={(e) => update('callback_window', e.target.value)}
                className={inputClass}
              >
                <option value="">Choose a window</option>
                {CALLBACK_WINDOWS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-[11px] text-[#57534e]">
              Times are shown in {timezone}. This is a callback preference, not a confirmed
              appointment.
            </p>
            <label className="hidden" aria-hidden="true">
              Company website
              <input
                tabIndex={-1}
                autoComplete="off"
                value={form.company_website}
                onChange={(e) => update('company_website', e.target.value)}
              />
            </label>
            <label className="flex items-start gap-2 text-xs text-[#57534e]">
              <input
                required
                type="checkbox"
                checked={form.contact_consent}
                onChange={(e) => update('contact_consent', e.target.checked)}
                className="mt-0.5"
              />
              <span>
                I agree to be contacted by the Close &amp; Relax team about this homeowners
                insurance request using the details I provided.
              </span>
            </label>
            <p className="text-[11px] text-[#57534e]">
              Your details are sent securely to the Close &amp; Relax team for this request. They
              are not added to hub analytics or saved in this browser.
            </p>
            <div ref={container} />
            {!siteKey && (
              <p role="status" className="text-xs text-[#57534e]">
                The request form is temporarily unavailable. Please try again later.
              </p>
            )}
            <button
              type="submit"
              disabled={!siteKey || saving}
              className="min-h-[44px] w-full rounded-xl bg-[#35543a] px-4 py-3 text-xs font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'Sending request…' : 'Request a callback'}
            </button>
          </fieldset>
          {error && (
            <p role="alert" className="text-xs text-red-700">
              {error}
            </p>
          )}
        </form>
      )}
      <button
        type="button"
        onClick={onClose}
        disabled={saving}
        className="min-h-[44px] text-xs underline text-[#57534e] mt-2"
      >
        {accepted ? 'Close' : 'Cancel'}
      </button>
    </div>
  );
}
