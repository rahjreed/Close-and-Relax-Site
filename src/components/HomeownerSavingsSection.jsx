import React, { useEffect, useState } from 'react';
import { Gift, ShieldCheck, Home, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { insuranceUrl } from '../lib/insuranceFunnel';
import {
  loadHomeownerSavingsDestinations,
  resolveHomeownerSavingsOffers,
  shouldShowHomeownerSavings,
} from '../lib/homeownerSavings';

export default function HomeownerSavingsSection({ profile, onOfferClick, preview = false }) {
  const visible = shouldShowHomeownerSavings(profile);
  const [data, setData] = useState({ offers: resolveHomeownerSavingsOffers(), error: null });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let current = true;
    if (!visible)
      return () => {
        current = false;
      };
    setLoading(true);
    loadHomeownerSavingsDestinations(supabase).then((result) => {
      if (current) {
        setData(result);
        setLoading(false);
      }
    });
    return () => {
      current = false;
    };
  }, [visible]);
  if (!visible) return null;
  return (
    <section
      aria-labelledby="homeowner-savings-title"
      aria-busy={loading}
      className="mb-10 rounded-3xl border border-[#d7e3d1] bg-[#eef4ec] p-5 sm:p-7"
    >
      <div className="flex items-start gap-3 mb-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#55704f] border border-[#d7e3d1]">
          <Gift className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#55704f]">
            A Close &amp; Relax homeowner benefit
          </p>
          <h2
            id="homeowner-savings-title"
            className="hub-font-serif text-2xl sm:text-3xl text-[#1c1917] mt-1"
          >
            Homeowner Savings
          </h2>
          <p className="text-xs text-[#57534e] leading-relaxed mt-2 max-w-xl">
            Helpful options for protecting your home and reviewing everyday homeownership costs,
            available through your Realtor’s Close &amp; Relax hub.
          </p>
        </div>
      </div>
      {data.error && (
        <p role="status" className="text-xs text-[#57534e] mb-4">
          {data.error}
        </p>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data.offers.map((offer) => {
          const Icon = offer.code === 'vivint' ? ShieldCheck : Home;
          return (
            <article
              key={offer.code}
              className="flex flex-col rounded-2xl border border-[#dce5d8] bg-white p-5"
            >
              <Icon className="h-5 w-5 text-[#55704f] mb-3" aria-hidden="true" />
              <p className="text-[10px] uppercase tracking-wider font-semibold text-[#55704f]">
                {offer.eyebrow}
              </p>
              <h3 className="hub-font-serif text-xl font-semibold text-[#1c1917] mt-2">
                {offer.title}
              </h3>
              <p className="text-xs leading-relaxed text-[#57534e] mt-3 mb-5">
                {offer.description}
              </p>
              <div className="mt-auto">
                {preview ? (
                  <button disabled type="button" className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#35543a] px-4 py-3 text-xs font-semibold text-white opacity-50">
                    {offer.ctaLabel}<ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  </button>
                ) : offer.href ? (
                  <a
                    href={offer.code === 'goosehead' ? insuranceUrl(profile?.id) : offer.href}
                    target={offer.external ? '_blank' : undefined}
                    rel={offer.external ? 'noopener noreferrer' : undefined}
                    onClick={async (event) => {
                      const navigate =
                        offer.code === 'goosehead' &&
                        event?.button === 0 &&
                        !event.metaKey &&
                        !event.ctrlKey &&
                        !event.shiftKey &&
                        !event.altKey;
                      if (navigate) event.preventDefault();
                      try {
                        const tracking = onOfferClick?.(offer.code);
                        if (navigate)
                          await Promise.race([
                            Promise.resolve(tracking),
                            new Promise((resolve) => setTimeout(resolve, 500)),
                          ]);
                      } catch {
                        /* Tracking never blocks navigation. */
                      }
                      if (navigate) window.location.assign(insuranceUrl(profile?.id));
                    }}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#35543a] px-4 py-3 text-xs font-semibold text-white hover:bg-[#29442d]"
                  >
                    {offer.ctaLabel}
                    <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  </a>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
      <p className="text-[10px] text-[#57534e] leading-relaxed mt-4">
        Options are managed by Close &amp; Relax, separate from your Realtor’s Preferred Vendors;
        display does not mean your Realtor personally selected or endorsed each offer.
        Confirm pricing, coverage, terms, and availability directly with the provider.
        Insurance services are provided through Goosehead Insurance; Close &amp; Relax helps
        connect you with an insurance professional.{' '}
        <a href="https://www.closeandrelax.com/privacy" target="_blank" rel="noopener noreferrer" className="underline inline-flex min-h-[44px] items-center">Privacy Policy</a>
      </p>
    </section>
  );
}
