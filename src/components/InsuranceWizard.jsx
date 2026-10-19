import React, { useEffect, useId, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  CALLBACK_WINDOWS,
  INSURANCE_TYPES,
  US_STATES,
  PROPERTY_ADDRESS_FIELDS,
  localToday,
  validateInsuranceStep,
  validateGooseheadLead,
  submitGooseheadLead,
} from '../lib/gooseheadLeads';

import { loadTurnstile, normalizeTurnstileSiteKey, turnstileFailure } from '../lib/turnstile';
const EMPTY_ADDRESS = Object.fromEntries(PROPERTY_ADDRESS_FIELDS.map(([name]) => [name, '']));
const STEPS = ['Coverage', 'Details', 'Contact', 'Callback', 'Review'];
const TITLES = [
  'What are you looking to review?',
  'A few coverage details',
  'How can we reach you?',
  'When works best for you?',
  'Review your request',
];

export default function InsuranceWizard({
  profileId = null,
  referralError = '',
  siteKey = import.meta.env?.VITE_TURNSTILE_SITE_KEY || '',
}) {
  const publicSiteKey = normalizeTurnstileSiteKey(siteKey);
  const [captchaIssue, setCaptchaIssue] = useState(null);
  const [captchaAttempt, setCaptchaAttempt] = useState(0);
  const formId = useId(),
    container = useRef(null),
    widget = useRef(null),
    heading = useRef(null),
    requestId = useRef(null);
  if (!requestId.current) requestId.current = crypto.randomUUID();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    insurance_type: '',
    full_name: '',
    phone: '',
    ...EMPTY_ADDRESS,
    email: '',
    callback_date: localToday(timezone),
    callback_window: '',
    contact_consent: false,
    company_website: '',
  });
  const [token, setToken] = useState(''),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(''),
    [accepted, setAccepted] = useState(false);
  useEffect(() => {
    heading.current?.focus();
  }, [step, accepted]);
  useEffect(() => {
    let current = true;
    if (!publicSiteKey || accepted || step !== 4) return;
    setToken('');
    setCaptchaIssue(null);
    loadTurnstile()
      .then((api) => {
        if (!current || !container.current) return;
        widget.current = api.render(container.current, {
          sitekey: publicSiteKey,
          size: 'compact',
          action: 'goosehead_lead',
          callback: (value) => {
            if (current) {
              setToken(value);
              setCaptchaIssue(null);
            }
          },
          'expired-callback': () => {
            if (current) {
              setToken('');
              setCaptchaIssue({
                message: 'Verification expired. Please verify again.',
                retryable: true,
                code: '',
              });
            }
          },
          'error-callback': (code) => {
            if (current) {
              setToken('');
              setCaptchaIssue(turnstileFailure(code));
            }
          },
        });
      })
      .catch(() => {
        if (current)
          setCaptchaIssue({
            message: 'Verification could not load. Please retry verification.',
            retryable: true,
            code: '',
          });
      });
    return () => {
      current = false;
      if (widget.current !== null && window.turnstile) {
        window.turnstile.remove(widget.current);
        widget.current = null;
      }
    };
  }, [publicSiteKey, accepted, step, captchaAttempt]);
  const update = (field, value) => {
    setError('');
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === 'insurance_type' && value === 'auto' ? EMPTY_ADDRESS : {}),
    }));
  };
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (referralError) {
      setError(referralError);
      return;
    }
    if (step < 4) {
      try {
        validateInsuranceStep({ ...form, callback_timezone: timezone }, step);
        setStep((value) => value + 1);
      } catch (err) {
        setError(err.message);
      }
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      if (!publicSiteKey)
        throw new Error('The request form is temporarily unavailable. Please try again later.');
      const lead = validateGooseheadLead({
        ...form,
        profile_id: profileId,
        request_id: requestId.current,
        callback_timezone: timezone,
      });
      await submitGooseheadLead(supabase, lead, token, form.company_website);
      setAccepted(true);
      setForm((current) => ({
        ...current,
        full_name: '',
        phone: '',
        email: '',
        ...EMPTY_ADDRESS,
        contact_consent: false,
      }));
    } catch (err) {
      setError(err.message);
      setToken('');
      if (widget.current !== null && window.turnstile) window.turnstile.reset(widget.current);
    } finally {
      setSaving(false);
    }
  };
  const inputClass =
    'block w-full min-h-[48px] rounded-xl border border-[#D4CBC0] px-4 py-3 mt-2 text-base bg-white text-[#292524] focus:outline-none focus:ring-2 focus:ring-[#B5966B]';
  if (accepted)
    return (
      <section className="rounded-3xl border border-[#D4CBC0] bg-white p-6 sm:p-10 text-center">
        <span
          aria-hidden="true"
          className="inline-flex rounded-full bg-[#eef4ec] p-4 text-2xl text-[#35543a]"
        >
          ✓
        </span>
        <h2 ref={heading} tabIndex={-1} className="insurance-serif text-3xl mt-5">
          Your request is in.
        </h2>
        <p role="status" className="mt-4 leading-relaxed text-[#57534e]">
          The Close &amp; Relax team has received your insurance request and callback preferences.
          Your requested time is a preference, not a confirmed appointment.
        </p>
        <a
          href="https://closeandrelax.com"
          className="inline-block mt-6 min-h-[44px] underline text-[#35543a]"
        >
          Explore Close &amp; Relax
        </a>
      </section>
    );
  const field = (label, name, type, autoComplete, maxLength) => (
    <label className="block text-sm font-medium">
      {label}
      <input
        required
        type={type}
        autoComplete={autoComplete}
        maxLength={maxLength}
        value={form[name]}
        onChange={(e) => update(name, e.target.value)}
        className={inputClass}
      />
    </label>
  );
  return (
    <section
      aria-label="Insurance review request"
      className="rounded-3xl border border-[#D4CBC0] bg-white p-5 sm:p-8 shadow-sm"
    >
      <ol aria-label="Your progress" className="grid grid-cols-5 gap-1 mb-7">
        {STEPS.map((label, index) => (
          <li
            key={label}
            aria-current={step === index ? 'step' : undefined}
            className={`text-center text-[10px] sm:text-xs ${index <= step ? 'text-[#35543a]' : 'text-[#78716c]'}`}
          >
            <span
              className={`block h-1.5 rounded-full mb-2 ${index <= step ? 'bg-[#35543a]' : 'bg-[#EEE8E0]'}`}
            />
            {label}
          </li>
        ))}
      </ol>
      <p className="text-xs uppercase tracking-widest text-[#8b704b]">Step {step + 1} of 5</p>
      <h2
        ref={heading}
        tabIndex={-1}
        id={`${formId}-title`}
        className="insurance-serif text-3xl sm:text-4xl leading-tight mt-2 mb-6"
      >
        {TITLES[step]}
      </h2>
      {referralError && (
        <p role="alert" className="mb-4 text-sm text-red-700">
          {referralError}{' '}
          <a href="/insurance" className="underline">
            Continue without a referral
          </a>
        </p>
      )}
      <form onSubmit={submit} aria-labelledby={`${formId}-title`}>
        <fieldset disabled={saving} className="space-y-5">
          {step === 0 && (
            <div className="space-y-3">
              {INSURANCE_TYPES.map((item) => (
                <label
                  key={item.value}
                  className={`flex min-h-[64px] cursor-pointer items-center gap-3 rounded-2xl border p-4 ${form.insurance_type === item.value ? 'border-[#35543a] bg-[#eef4ec]' : 'border-[#D4CBC0]'}`}
                >
                  <input
                    required
                    type="radio"
                    name="insurance_type"
                    value={item.value}
                    checked={form.insurance_type === item.value}
                    onChange={() => {
                      update('insurance_type', item.value);
                    }}
                    className="h-5 w-5 accent-[#35543a]"
                  />
                  <span className="font-semibold">{item.label}</span>
                </label>
              ))}
              <p className="text-sm leading-relaxed text-[#57534e]">
                Choose what you’d like to discuss. No policy numbers or payment details needed.
              </p>
            </div>
          )}
          {step === 1 &&
            (form.insurance_type === 'auto' ? (
              <div className="rounded-2xl bg-[#f7f4ef] p-5">
                <h3 className="font-semibold">Let’s start with auto coverage.</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#57534e]">
                  No property address needed. An insurance professional can discuss vehicle and
                  driver details with you during your callback.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-[#57534e]">
                  The U.S. property you’d like to review coverage for.
                </p>
                {PROPERTY_ADDRESS_FIELDS.map(([name, label, autoComplete, maxLength]) => (
                  <label key={name} className="block text-sm font-medium">
                    {label}
                    {name === 'state' ? (
                      <select
                        required
                        autoComplete={autoComplete}
                        value={form.state}
                        onChange={(e) => update('state', e.target.value)}
                        className={inputClass}
                      >
                        <option value="">Choose a state</option>
                        {US_STATES.map((state) => (
                          <option key={state} value={state}>
                            {state}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        required={name !== 'apt_unit'}
                        type="text"
                        autoComplete={autoComplete}
                        maxLength={maxLength}
                        inputMode={name === 'zip_code' ? 'numeric' : undefined}
                        pattern={name === 'zip_code' ? '[0-9]{5}(-[0-9]{4})?' : undefined}
                        value={form[name]}
                        onChange={(e) => update(name, e.target.value)}
                        className={inputClass}
                      />
                    )}
                  </label>
                ))}
              </div>
            ))}
          {step === 2 && (
            <>
              {field('Name', 'full_name', 'text', 'name', 160)}
              {field('Phone number', 'phone', 'tel', 'tel', 50)}
              {field('Email address', 'email', 'email', 'email', 254)}
            </>
          )}
          {step === 3 && (
            <>
              <label className="block text-sm font-medium">
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
              <label className="block text-sm font-medium">
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
              <p className="text-xs leading-relaxed text-[#57534e]">
                Times are shown in {timezone}. This is a callback preference, not a confirmed
                appointment.
              </p>
            </>
          )}
          {step === 4 && (
            <>
              <dl className="rounded-2xl bg-[#f7f4ef] p-4 space-y-4 text-sm break-words">
                {[
                  [
                    'Coverage',
                    INSURANCE_TYPES.find((item) => item.value === form.insurance_type)?.label,
                  ],
                  ...(form.insurance_type === 'auto'
                    ? []
                    : PROPERTY_ADDRESS_FIELDS.map(([name, label]) => [
                        label,
                        form[name] || 'Not provided',
                      ])),
                  ['Name', form.full_name],
                  ['Phone', form.phone],
                  ['Email', form.email],
                  ['Callback', `${form.callback_date} · ${form.callback_window} (${timezone})`],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-[#78716c]">{label}</dt>
                    <dd className="mt-1 whitespace-pre-wrap">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs leading-relaxed text-[#57534e]">
                Insurance services are provided through Goosehead Insurance. Close &amp; Relax
                helps connect you with the appropriate insurance professional.
              </p>
              <label className="flex min-h-[44px] items-start gap-3 text-sm leading-relaxed text-[#57534e]">
                <input
                  required
                  type="checkbox"
                  checked={form.contact_consent}
                  onChange={(e) => update('contact_consent', e.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 accent-[#35543a]"
                />
                <span>
                  I agree to be contacted by the Close &amp; Relax team about this insurance request
                  using the details I provided.
                </span>
              </label>
              <p className="text-xs leading-relaxed text-[#57534e]">
                Your details are sent securely to the Close &amp; Relax team for this request. They
                are not added to hub analytics or saved in browser storage. The current form
                requests contact from Close &amp; Relax; it does not automatically send your
                details to Goosehead. Read our{' '}
                <a href="/privacy#section-4" target="_blank" rel="noopener noreferrer" className="underline inline-flex min-h-[44px] items-center">Privacy Policy</a>{' '}
                and{' '}<a href="/terms" target="_blank" rel="noopener noreferrer" className="underline inline-flex min-h-[44px] items-center">Terms of Service</a>.
              </p>
              {captchaIssue && (
                <div role="alert" className="text-sm text-red-700">
                  <p>
                    {captchaIssue.message}
                    {captchaIssue.code ? ` (Reference ${captchaIssue.code})` : ''}
                  </p>
                  {captchaIssue.retryable && (
                    <button
                      type="button"
                      onClick={() => {
                        setToken('');
                        setCaptchaIssue(null);
                        setCaptchaAttempt((value) => value + 1);
                      }}
                      className="min-h-[44px] mt-2 underline"
                    >
                      Retry verification
                    </button>
                  )}
                </div>
              )}
              <div ref={container} className="min-h-[65px]" />
              {!publicSiteKey && (
                <p role="status" className="text-sm text-[#57534e]">
                  The request form is temporarily unavailable. Please try again later.
                </p>
              )}
            </>
          )}
          <label className="hidden" aria-hidden="true">
            Company website
            <input
              tabIndex={-1}
              autoComplete="off"
              value={form.company_website}
              onChange={(e) => update('company_website', e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
              {error.startsWith('This referral is unavailable.') && (
                <a href="/insurance" className="block mt-2 underline">
                  Continue without a referral
                </a>
              )}
            </p>
          )}
          <div className="flex items-center gap-3 pt-3">
            {step > 0 && (
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setStep((value) => value - 1);
                }}
                className="min-h-[48px] px-4 text-sm underline"
              >
                Back
              </button>
            )}
            <button
              type="submit"
              disabled={!!referralError || saving || (step === 4 && (!publicSiteKey || !token))}
              className="min-h-[48px] flex-1 rounded-xl bg-[#35543a] px-6 py-3 text-sm font-semibold text-white hover:bg-[#29442d] disabled:opacity-50"
            >
              {saving ? 'Sending request…' : step === 4 ? 'Request my callback' : 'Continue'}
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
