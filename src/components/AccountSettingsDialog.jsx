import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { MIN_PASSWORD_LENGTH } from '../lib/passwordPolicy';

const button = 'min-h-[44px] rounded-xl border border-[#D4CBC0] bg-[#FCFAF6] px-4 py-2 text-xs font-semibold text-charcoal-deep hover:bg-[#E5DED5] disabled:opacity-50';
export default function AccountSettingsDialog({ user, profile, planName, vendorLimit, onClose, onEditProfile, onResetPassword, onPublication, onSupport, onClosure, onLogout, logoutLoading, logoutError }) {
  const dialog = useRef(null), close = useRef(null);
  useEffect(() => {
    const previous = document.activeElement, overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; close.current?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus?.(); };
  }, []);
  const keys = (event) => {
    if (event.key === 'Escape') onClose();
    if (event.key !== 'Tab') return;
    const nodes = [...dialog.current.querySelectorAll('button:not(:disabled),a[href],[tabindex="0"]')].filter(node => node.getClientRects().length);
    const first = nodes[0], last = nodes.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#191816]/65 p-3 backdrop-blur-sm sm:p-6">
    <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="account-settings-title" onKeyDown={keys}
      className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#D4CBC0] bg-[#F8F5EF] shadow-2xl">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#D4CBC0] p-5 sm:px-7">
        <div><p className="text-[10px] uppercase tracking-widest text-[#8C6B38]">Close &amp; Relax</p><h2 id="account-settings-title" className="font-editorial text-2xl font-semibold text-charcoal-deep">Account &amp; Settings</h2></div>
        <button ref={close} type="button" onClick={onClose} aria-label="Close account settings" className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl hover:bg-[#E5DED5]"><X className="h-5 w-5" /></button>
      </header>
      <div className="min-h-0 overflow-y-auto p-5 sm:p-7">
        <div className="grid gap-5 sm:grid-cols-2">
          <section className="min-w-0 space-y-3 rounded-xl border border-[#D4CBC0] p-4">
            <h3 className="text-sm font-semibold text-charcoal-deep">Public Realtor contact</h3>
            <p className="break-all text-sm text-charcoal-deep">{profile.email || 'No public email saved'}</p>
            <p className="text-xs leading-relaxed text-charcoal-muted">Your profile name, email and phone are shown to homeowners when your hub is published. Editing these does not change your login email.</p>
            <button type="button" className={button} onClick={onEditProfile}>Edit public profile</button>
          </section>
          <section className="min-w-0 space-y-3 rounded-xl border border-[#D4CBC0] p-4">
            <h3 className="text-sm font-semibold text-charcoal-deep">Login &amp; security</h3>
            <p className="text-[11px] text-charcoal-muted">Login email</p><p className="break-all text-sm text-charcoal-deep">{user.email || 'Unavailable — sign in again'}</p>
            <p className="text-xs leading-relaxed text-charcoal-muted">Login-email changes are not available here yet. Contact Support for help; changing the public contact email leaves this login unchanged.</p>
            <p className="text-xs leading-relaxed text-charcoal-muted">Request a secure email link to choose a new password of at least {MIN_PASSWORD_LENGTH} characters.</p>
            <button type="button" className={button} disabled={!user.email} onClick={onResetPassword}>Reset password</button>
          </section>
          <section className="min-w-0 space-y-3 rounded-xl border border-[#D4CBC0] p-4">
            <h3 className="text-sm font-semibold text-charcoal-deep">Plan &amp; subscription</h3>
            <p className="text-sm font-semibold text-charcoal-deep">{planName} · up to {vendorLimit} preferred vendors</p>
            <p className="text-xs leading-relaxed text-charcoal-muted">This is your current plan access, not a billing statement. Online billing and self-service subscription changes are not available yet. Plan access is managed by Close &amp; Relax.</p>
            <button type="button" className={button} onClick={onSupport}>Ask about your plan</button>
          </section>
          <section className="min-w-0 space-y-3 rounded-xl border border-[#D4CBC0] p-4">
            <h3 className="text-sm font-semibold text-charcoal-deep">Hub visibility</h3>
            <p className="text-sm font-semibold text-charcoal-deep">{profile.is_published ? 'Published — publicly available' : 'Unpublished — private draft'}</p>
            <p className="text-xs leading-relaxed text-charcoal-muted">Preview is private and does not publish your hub. Publish makes it available at your Realtor link; Unpublish hides it from public visitors.</p>
            <button type="button" className={button} onClick={onPublication}>Manage hub visibility</button>
          </section>
        </div>
        <section className="mt-5 space-y-3 border-t border-[#D4CBC0] pt-5">
          <h3 className="text-sm font-semibold text-charcoal-deep">Support &amp; account requests</h3>
          <p className="text-xs leading-relaxed text-charcoal-muted">Questions go to the private Close &amp; Relax Support Inbox. Account closure and deletion are handled manually after ownership verification and review. A request does not instantly close or delete your account.</p>
          <div className="flex flex-wrap gap-3"><button type="button" className={button} onClick={onSupport}>Contact Support</button><button type="button" className={button} onClick={onClosure}>Request account closure / deletion</button></div>
        </section>
        <div className="mt-5 border-t border-[#D4CBC0] pt-5">
          {logoutError && <p role="alert" className="mb-3 text-sm text-red-700">{logoutError}</p>}
          <button type="button" disabled={logoutLoading} onClick={onLogout} className={button}>{logoutLoading ? 'Logging out…' : 'Log Out'}</button>
        </div>
      </div>
    </section>
  </div>;
}
