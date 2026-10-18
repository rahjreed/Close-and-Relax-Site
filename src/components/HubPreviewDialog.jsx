import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { loadOwnHubPreview } from '../lib/hubPreview';
import { recordRealtorPreview } from '../lib/realtorSetup';
import PublicRealtorHub from './PublicRealtorHub';

class PreviewBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function HubPreviewDialog({ userId, getPlanConfig, fallbackResources, onClose, onHistorySaved, onHistoryError }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [rendered, setRendered] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [historyAttempt, setHistoryAttempt] = useState(0);
  const [historySaving, setHistorySaving] = useState(false);
  const dialog = useRef(null), back = useRef(null);
  const renderedCallback = useCallback(() => setRendered(true), []);
  const renderError = useCallback(() => { setRendered(false); setError('Your hub could not be rendered. Please retry the preview.'); }, []);
  const callbacks = useRef({ onClose, onHistorySaved, onHistoryError });
  callbacks.current = { onClose, onHistorySaved, onHistoryError };

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    back.current?.focus();
    const keyboard = (event) => {
      if (event.key === 'Escape') callbacks.current.onClose();
      if (event.key !== 'Tab') return;
      const nodes = Array.from(dialog.current?.querySelectorAll('a[href],button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]') || [])
        .filter((node) => node.getClientRects().length);
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', keyboard);
      previousFocus?.focus?.();
    };
  }, []);

  useEffect(() => {
    let current = true;
    setProfile(null); setError(''); setRendered(false); setHistoryError(false);
    loadOwnHubPreview(supabase, userId, getPlanConfig)
      .then((saved) => { if (current) setProfile(saved); })
      .catch(() => { if (current) setError('Your saved hub could not be loaded. Sign in to your own account and retry.'); });
    return () => { current = false; };
  }, [userId, getPlanConfig, attempt]);

  useEffect(() => {
    if (!rendered || !profile || profile.id !== userId || error) return;
    let current = true;
    // Wait a frame so render/commit errors reach the boundary before saving.
    const frame = window.requestAnimationFrame(async () => {
      if (!current) return;
      setHistorySaving(true);
      try {
        const timestamp = await recordRealtorPreview(supabase, userId);
        if (current) { setHistoryError(false); callbacks.current.onHistorySaved?.(userId, timestamp); }
      } catch {
        if (current) { setHistoryError(true); callbacks.current.onHistoryError?.(userId); }
      } finally {
        if (current) setHistorySaving(false);
      }
    });
    return () => { current = false; window.cancelAnimationFrame(frame); };
  }, [rendered, profile, userId, error, historyAttempt]);

  return (
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="private-hub-preview-title" className="fixed inset-0 z-[100] overflow-y-auto bg-[#faf8f5]">
      <div className="sticky top-0 z-50 border-b border-[#D4CBC0] bg-[#2E2A26] px-4 py-3 text-[#FAF7F2] sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 id="private-hub-preview-title" className="text-sm font-semibold">{profile?.is_published ? 'Private preview — published hub' : 'Private preview — not published'}</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-[#D8D0C6]">Only you can see this dashboard preview. Showing saved changes. Calls, offers, sharing and installation are disabled; checklist changes are temporary.</p>
          </div>
          <button ref={back} type="button" onClick={onClose} className="min-h-[44px] shrink-0 rounded-xl border border-[#B5966B] px-4 py-2 text-xs font-semibold">Back to dashboard</button>
        </div>
        {historyError && <div role="alert" className="mx-auto mt-2 max-w-6xl text-xs">Preview loaded, but setup history could not be saved. Publishing is still available.
          <button type="button" disabled={historySaving} onClick={() => setHistoryAttempt((value) => value + 1)} className="ml-2 min-h-[44px] underline disabled:opacity-50">Retry saving history</button>
        </div>}
      </div>
      {error ? <div role="alert" className="mx-auto max-w-lg p-6 text-sm text-[#57534e]">
        <p>{error}</p><button type="button" onClick={() => setAttempt((value) => value + 1)} className="mt-3 min-h-[44px] rounded-xl border border-[#D4CBC0] px-4 py-2">Retry preview</button>
      </div> : profile?.id === userId ? (
        <PreviewBoundary key={`${userId}-${attempt}`} onError={renderError}>
          <PublicRealtorHub profile={profile} fallbackResources={fallbackResources} preview onPreviewReady={renderedCallback} />
        </PreviewBoundary>
      ) : <p role="status" className="p-6 text-sm text-[#57534e]">Loading your saved hub…</p>}
    </div>
  );
}
