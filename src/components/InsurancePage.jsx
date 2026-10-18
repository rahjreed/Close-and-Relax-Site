import React, { useEffect } from 'react';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import InsuranceWizard from './InsuranceWizard';
import { insuranceReferral } from '../lib/insuranceFunnel';

export default function InsurancePage() {
  const referral = insuranceReferral(window.location.search);
  useEffect(() => {
    const previous = document.title;
    document.title = 'Home & Auto Insurance | Close & Relax';
    return () => {
      document.title = previous;
    };
  }, []);
  return (
    <main className="insurance-page min-h-screen bg-[#FAF7F2] text-[#292524] antialiased">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        .insurance-page { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; }
        .insurance-page .insurance-serif { font-family: 'Cormorant Garamond', Georgia, serif; }
        .insurance-page :focus-visible { outline: 2px solid #B5966B; outline-offset: 4px; }
        .insurance-page h2:focus-visible { outline: none; }
      `}</style>
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6 sm:px-8">
        <a
          href="https://closeandrelax.com"
          className="insurance-serif text-2xl font-semibold tracking-tight"
        >
          Close &amp; Relax
          <span className="block font-sans text-[9px] uppercase tracking-[0.25em] text-[#8b704b]">
            Resources for life at home
          </span>
        </a>
        <a
          href="https://closeandrelax.com"
          aria-label="Back to Close & Relax"
          className="flex min-h-[44px] items-center gap-2 text-xs text-[#57534e]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Close &amp; Relax</span>
        </a>
      </header>
      <div className="mx-auto max-w-5xl px-5 pb-12 pt-4 sm:px-8 sm:pt-10 lg:grid lg:grid-cols-[1fr_1.2fr] lg:gap-12">
        <div className="mb-8 lg:pt-8">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#D4CBC0] px-3 py-2 text-[10px] uppercase tracking-widest text-[#8b704b]">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Insurance, on your terms
          </span>
          <h1 className="insurance-serif text-5xl leading-[1.05] sm:text-6xl">
            Home &amp; Auto Insurance
          </h1>
          <p className="mt-4 text-xs font-medium leading-relaxed text-[#57534e]">
            Insurance partner: Goosehead Insurance
          </p>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-[#57534e]">
            Compare coverage options with help from our insurance partner, Goosehead Insurance.
            Tell us what you’d like to review, then choose a time for a callback.
          </p>
          <p className="mt-4 text-xs leading-relaxed text-[#78716c]">
            No account needed. Start with a few details—coverage, pricing, eligibility and
            availability are confirmed directly with an insurance professional.
          </p>
        </div>
        <InsuranceWizard profileId={referral.profileId} referralError={referral.error} />
      </div>
      <footer className="border-t border-[#D4CBC0] px-5 py-6 text-center text-[11px] leading-relaxed text-[#78716c]">
        Close &amp; Relax · A convenient way to start an insurance conversation.
        <br />
        Submitting a request does not bind coverage or guarantee a quote, savings or a callback
        time.
      </footer>
    </main>
  );
}
