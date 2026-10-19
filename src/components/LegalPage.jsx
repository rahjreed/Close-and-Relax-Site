import React, { useEffect, useState } from 'react';
import { LEGAL_PAGES, LEGAL_REVIEW_NOTICE } from '../lib/legalPages';
import SupportContactDialog from './SupportContactDialog';

export default function LegalPage({ page }) {
  const content = LEGAL_PAGES[page];
  const [supportOpen, setSupportOpen] = useState(false);
  useEffect(() => {
    const previous = document.title;
    document.title = `${content.title} | Close & Relax`;
    return () => { document.title = previous; };
  }, [content.title]);
  return <div className="legal-page min-h-screen bg-[#FAF7F2] text-[#292524] font-sans">
    {/* Support is shared with the dashboard, whose local theme is not mounted here. */}
    <style>{`
      .legal-page .bg-cream-warm { background-color: #FAF7F2; }
      .legal-page .bg-cream-card { background-color: #FDFBF7; }
      .legal-page .bg-cream-subtle { background-color: #F3EEE7; }
      .legal-page .border-cream-border { border-color: #E8E2D8; }
      .legal-page .text-charcoal-deep { color: #191816; }
      .legal-page .text-charcoal-muted { color: #58524B; }
      .legal-page .text-gold-accent { color: #8C6B38; }
      .legal-page .font-editorial { font-family: Georgia, serif; }
    `}</style>
    <header className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 border-b border-[#D4CBC0] px-5 py-5 sm:px-8">
      <a className="min-h-[44px] inline-flex items-center font-serif text-2xl font-semibold" href="https://www.closeandrelax.com">Close &amp; Relax</a>
      <a href="/dashboard" className="inline-flex min-h-[44px] items-center text-sm underline">Realtor dashboard</a>
    </header>
    <main id="legal-content" className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
      <h1 className="font-serif text-4xl sm:text-5xl">{content.title}</h1>
      <p role="note" className="mt-5 rounded-xl border border-[#D4CBC0] bg-[#F3EEE7] p-4 text-sm leading-relaxed">{LEGAL_REVIEW_NOTICE}</p>
      <p className="mt-6 text-sm leading-7">{content.introduction}</p>
      <nav aria-label="On this page" className="my-7 flex flex-col items-start gap-1 text-sm">
        {content.sections.map(([title], index) => <a className="min-h-[44px] inline-flex items-center underline underline-offset-4" key={title} href={`#section-${index + 1}`}>{title}</a>)}
      </nav>
      {content.sections.map(([title, text], index) => <section key={title} id={`section-${index + 1}`} className="mt-8 scroll-mt-6">
        <h2 className="font-serif text-2xl font-semibold">{title}</h2><p className="mt-3 text-sm leading-7">{text}</p>
      </section>)}
      <button type="button" onClick={() => setSupportOpen(true)} className="mt-8 min-h-[44px] rounded-xl bg-[#191816] px-5 py-3 text-sm font-semibold text-[#FAF7F2]">Contact Support</button>
    </main>
    <footer className="border-t border-[#D4CBC0] px-5 py-6 text-center text-xs">
      <nav aria-label="Legal" className="flex flex-wrap justify-center gap-x-6"><a className="min-h-[44px] inline-flex items-center underline" aria-current={page === 'privacy' ? 'page' : undefined} href="/privacy">Privacy Policy</a><a className="min-h-[44px] inline-flex items-center underline" aria-current={page === 'terms' ? 'page' : undefined} href="/terms">Terms of Service</a></nav>
    </footer>
    {supportOpen && <SupportContactDialog onClose={() => setSupportOpen(false)} />}
  </div>;
}
