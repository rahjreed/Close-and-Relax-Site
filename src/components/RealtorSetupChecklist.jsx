import React, { useId, useState } from 'react';
import { Check, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { getRealtorSetup } from '../lib/realtorSetup';

export default function RealtorSetupChecklist({ onAction, publishLoading = false, loading = false, previewHistoryError = '', ...data }) {
  const { steps, completed, total, percent, allComplete } = getRealtorSetup(data);
  const [reopened, setReopened] = useState(false);
  const headingId = useId(), listId = useId();
  const expanded = !allComplete || reopened;
  return (
    <section aria-labelledby={headingId} aria-busy={loading} className="my-8 rounded-2xl border border-[#D4CBC0] bg-[#EEE8E0] p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-gold-accent" aria-hidden="true" />
            <h2 id={headingId} className="font-editorial text-xl font-bold text-charcoal-deep">{allComplete ? 'Your hub is ready 🎉' : 'Finish setting up your hub'}</h2>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-charcoal-muted">{allComplete ? 'Your saved hub is ready to share. Reopen these steps whenever you need them.' : 'A few saved details make your hub feel like you. Progress updates automatically.'}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <p className="text-xs font-semibold text-charcoal-deep" role="status">{completed} of {total} complete · {percent}%</p>
          {allComplete && (
            <button type="button" aria-expanded={expanded} aria-controls={listId} onClick={() => setReopened(!reopened)} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#D4CBC0] bg-[#FCFAF6] px-3 py-2 text-xs font-semibold text-charcoal-deep">
              {expanded ? 'Hide checklist' : 'View checklist'}
              {expanded ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
            </button>
          )}
        </div>
      </div>
      <div role="progressbar" aria-label="Hub setup progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={`${completed} of ${total} complete`} className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#DDD6CB]">
        <div className="h-full rounded-full bg-[#B89561] transition-all duration-300" style={{ width: `${percent}%` }} />
      </div>
      {expanded && (
        <ol id={listId} className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
          {steps.map((step, index) => (
            <li key={step.id} className="flex min-w-0 items-start gap-3 rounded-xl border border-[#D4CBC0] bg-[#FCFAF6] p-4">
              <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${step.complete ? 'bg-[#2E2A26] text-[#D8BC8B]' : 'bg-[#E5DED5] text-charcoal-muted'}`} aria-hidden="true">{step.complete ? <Check className="h-3.5 w-3.5" /> : index + 1}</span>
              <div className="min-w-0">
                <h3 className="text-xs font-semibold text-charcoal-deep">{step.title}{step.complete && <span className="sr-only"> — Complete</span>}</h3>
                <p className="mt-1 break-words text-[11px] leading-relaxed text-charcoal-muted">{step.detail}</p>
                {!step.complete && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" disabled={loading || step.disabled || (step.id === 'publish' && publishLoading)} onClick={() => onAction(step.id)} className="min-h-[44px] rounded-xl border border-[#D4CBC0] bg-[#E5DED5] px-3 py-2 text-xs font-semibold text-charcoal-deep hover:bg-[#D8D0C5] disabled:opacity-50">{step.id === 'publish' && publishLoading ? 'Publishing…' : step.action}</button>
                    {step.alternativeAction && <button type="button" disabled={loading} onClick={() => onAction('sections')} className="min-h-[44px] rounded-xl px-2 py-2 text-xs font-semibold text-charcoal-muted underline disabled:opacity-50">{step.alternativeAction}</button>}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
      {previewHistoryError && <p role="status" className="mt-3 text-[11px] leading-relaxed text-charcoal-muted">{previewHistoryError}</p>}
    </section>
  );
}
