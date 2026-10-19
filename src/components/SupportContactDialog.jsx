import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { loadTurnstile, normalizeTurnstileSiteKey, turnstileFailure } from '../lib/turnstile';
import { sendSupportMessage, supportFallbackUrl, validateSupportContact } from '../lib/supportContact';

export default function SupportContactDialog({ onClose, initialName = '', initialEmail = '', initialMessage = '' }) {
  const [draft, setDraft] = useState({ name: initialName, email: initialEmail, message: initialMessage, company_website: '' });
  const [token, setToken] = useState(''), [error, setError] = useState('');
  const [verificationError, setVerificationError] = useState(''), [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false), [reference, setReference] = useState('');
  const [submissionFailed, setSubmissionFailed] = useState(false);
  const requestId = useRef(crypto.randomUUID()), container = useRef(null), dialog = useRef(null);
  const successHeading = useRef(null), previousFocus = useRef(null), submitting = useRef(false);
  const siteKey = normalizeTurnstileSiteKey(import.meta.env.VITE_TURNSTILE_SITE_KEY);
  const fallback = supportFallbackUrl(import.meta.env.VITE_SUPPORT_FALLBACK_URL);
  useEffect(() => {
    previousFocus.current = document.activeElement;
    dialog.current?.focus();
    return () => previousFocus.current?.focus?.();
  }, []);
  useEffect(() => { if (reference) successHeading.current?.focus(); }, [reference]);
  useEffect(() => {
    let current = true, widget;
    setToken('');
    setVerificationError('');
    if (!siteKey || reference) return;
    loadTurnstile().then((api) => {
      if (!current || !container.current) return;
      widget = api.render(container.current, {
        sitekey: siteKey, action: 'support_contact', size: 'compact',
        callback: (value) => { if (current) { setToken(value); setVerificationError(''); } },
        'expired-callback': () => { if (current) { setToken(''); setVerificationError('Verification expired. Please retry verification.'); } },
        'error-callback': (code) => { if (current) { setToken(''); setVerificationError(turnstileFailure(code).message); } },
      });
    }).catch(() => { if (current) setVerificationError('Verification could not load. Please retry verification.'); });
    return () => { current = false; if (widget !== undefined) window.turnstile?.remove(widget); };
  }, [siteKey, reference, attempt]);
  const update = (key, value) => {
    requestId.current = crypto.randomUUID();
    setDraft((old) => ({ ...old, [key]: value }));
    setError('');
    setSubmissionFailed(false);
  };
  const submit = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    setError('');
    setSubmissionFailed(false);
    let attemptedDelivery = false;
    try {
      const message = validateSupportContact({ ...draft, request_id: requestId.current });
      submitting.current = true;
      setSaving(true);
      attemptedDelivery = true;
      const receipt = await sendSupportMessage(supabase, message, token, draft.company_website);
      setReference(receipt);
      setDraft({ name: '', email: '', message: '', company_website: '' });
    } catch (failure) {
      setError(failure.message);
      setSubmissionFailed(attemptedDelivery);
      setAttempt((old) => old + 1);
    } finally { submitting.current = false; setSaving(false); }
  };
  const handleKeys = (event) => {
    if (event.key === 'Escape' && !saving) onClose();
    if (event.key !== 'Tab') return;
    const nodes = [...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),a[href],iframe')].filter((node) => node.getClientRects().length);
    const first = nodes[0], last = nodes.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-[#191816]/65 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="support-title" tabIndex={-1} onKeyDown={handleKeys}
        className="bg-cream-warm rounded-3xl max-w-md w-full border border-cream-border shadow-2xl overflow-hidden relative my-auto animate-fade-in">
        <div className="p-6 border-b border-cream-border flex items-center justify-between bg-cream-card">
          <div><span className="text-[10px] uppercase tracking-widest text-gold-accent font-semibold">Assistance</span>
            <h3 id="support-title" className="font-editorial text-2xl font-bold text-charcoal-deep">Contact Support</h3></div>
          <button type="button" aria-label="Close support" disabled={saving} onClick={onClose} className="min-w-[44px] min-h-[44px] rounded-full bg-cream-subtle flex items-center justify-center disabled:opacity-50"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 sm:p-8">
          {reference ? <div className="space-y-4">
            <h4 ref={successHeading} tabIndex={-1} className="font-editorial text-2xl font-bold text-charcoal-deep">Message saved</h4>
            <p role="status" className="text-sm text-charcoal-muted">Your message is in the Close &amp; Relax Support Inbox for review. We can reply using the email address you provided. No automatic email confirmation is sent.</p>
            <p className="text-xs text-charcoal-muted break-all">Reference: {reference}</p>
            <button type="button" onClick={onClose} className="min-h-[44px] px-6 rounded-full bg-[#191816] text-[#FAF7F2]">Done</button>
          </div> : <form onSubmit={submit} className="space-y-4 text-left">
            <p className="text-sm text-charcoal-muted">Send a question about your Close &amp; Relax account, setup, or features. Messages go to our private Support Inbox. Please do not include passwords or sensitive homeowner information.</p>
            <fieldset disabled={saving} className="space-y-4 disabled:opacity-60">
              {[['name', 'Name', 'text', 160], ['email', 'Email', 'email', 254]].map(([key, label, type, max]) => <div key={key}>
                <label htmlFor={`support-${key}`} className="block text-xs font-semibold mb-1">{label}</label>
                <input id={`support-${key}`} type={type} autoComplete={key} required maxLength={max} value={draft[key]} onChange={(e) => update(key, e.target.value)} className="w-full min-h-[44px] text-base px-4 py-2.5 rounded-xl bg-cream-card border border-cream-border" />
              </div>)}
              <div><label htmlFor="support-message" className="block text-xs font-semibold mb-1">How can we assist?</label>
                <textarea id="support-message" required maxLength={4000} rows={4} value={draft.message} onChange={(e) => update('message', e.target.value)} className="w-full text-base px-4 py-2.5 rounded-xl bg-cream-card border border-cream-border" /></div>
              <div className="hidden" aria-hidden="true"><label>Company website<input tabIndex={-1} autoComplete="off" value={draft.company_website} onChange={(e) => update('company_website', e.target.value)} /></label></div>
            </fieldset>
            <p className="text-xs text-charcoal-muted">By sending, you ask Close &amp; Relax to review your message and contact you about this request.</p>
            <div ref={container} />
            {(!siteKey || verificationError) && <p role="alert" className="text-sm text-red-700">{verificationError || 'Verification is unavailable. Please try again later.'}</p>}
            {siteKey && verificationError && <button type="button" disabled={saving} onClick={() => setAttempt((old) => old + 1)} className="min-h-[44px] text-sm underline">Retry verification</button>}
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={saving || !token} className="w-full min-h-[44px] py-3 px-6 rounded-full bg-[#191816] text-[#FAF7F2] text-sm font-semibold disabled:opacity-50">{saving ? 'Sending…' : 'Send message'}</button>
          </form>}
          {submissionFailed && !reference && !saving && fallback && <p className="mt-4 text-sm text-charcoal-muted">Unable to send through the form? <a href={fallback} className="underline inline-flex items-center min-h-[44px]" rel="noopener noreferrer">Use our alternative contact</a></p>}
        </div>
      </div>
    </div>
  );
}
