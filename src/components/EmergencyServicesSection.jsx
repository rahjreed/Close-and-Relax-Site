import React from 'react';
import { AlertCircle, Phone, ExternalLink } from 'lucide-react';
import {
  EMERGENCY_CATEGORIES,
  emergencyPhoneHref,
  hasConfirmedEmergencyAvailability,
  normalizeEmergencyWebsite,
} from '../lib/emergencyServices';

export default function EmergencyServicesSection({
  categories = EMERGENCY_CATEGORIES,
  assignments = [],
  loading = false,
  error = null,
  realtorPhone = '',
  realtorEmail = '',
}) {
  return (
    <section className="mb-12" aria-labelledby="emergency-services-title" aria-busy={loading}>
      <div className="text-center lg:text-left mb-5">
        <span className="text-[10px] uppercase tracking-[0.25em] font-semibold text-[#9c7844]">
          Included for Every Homeowner
        </span>
        <h2
          id="emergency-services-title"
          className="hub-font-serif text-2xl sm:text-3xl text-[#1c1917] font-medium mt-1"
        >
          Emergency &amp; Urgent Services
        </h2>
      </div>
      <div className="rounded-2xl border border-[#dbcbb4] bg-[#f7f2ea] p-4 mb-4 text-sm text-[#292524]">
        <p className="font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          Immediate danger?{' '}
          <a href="tel:911" className="underline underline-offset-2">
            Call 911.
          </a>
        </p>
        <p className="text-xs text-[#57534e] mt-1">
          For property-service needs, contact a provider below and confirm availability directly.
          Response times are not guaranteed.
        </p>
      </div>
      {error && (
        <p role="status" className="text-xs text-[#57534e] mb-4">
          {error} Your Realtor may be able to suggest a contact.
        </p>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {EMERGENCY_CATEGORIES.map((slot) => {
          const category = categories.find(({ code }) => code === slot.code) || slot;
          const provider = assignments.find(({ category_code }) => category_code === slot.code);
          let website = '';
          try {
            website = normalizeEmergencyWebsite(provider?.website);
          } catch {
            /* Hide invalid stored links. */
          }
          return (
            <article
              key={slot.code}
              className="bg-white rounded-2xl p-5 border border-[#ede4d6] hub-editorial-shadow"
            >
              <h3 className="hub-font-serif text-xl font-semibold text-[#1c1917]">
                {category.label}
              </h3>
              {provider ? (
                <>
                  <p className="text-sm font-semibold text-[#292524] mt-3">
                    {provider.provider_name}
                  </p>
                  {hasConfirmedEmergencyAvailability(provider) && (
                    <p className="text-[11px] text-[#55704f] mt-2">
                      Realtor-confirmed 24/7 availability.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3 mt-4">
                    <a
                      href={`tel:${emergencyPhoneHref(provider.phone)}`}
                      aria-label={`Call ${provider.provider_name} for ${category.label}`}
                      className="inline-flex items-center gap-2 bg-[#292524] text-white rounded-xl px-4 py-2.5 text-xs font-semibold"
                    >
                      <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                      {provider.phone}
                    </a>
                    {website && (
                      <a
                        href={website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 border border-[#dcd1be] rounded-xl px-4 py-2.5 text-xs font-semibold text-[#292524]"
                      >
                        Website
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-[#57534e] leading-relaxed mt-3">
                    {loading
                      ? 'Loading provider details…'
                      : error
                        ? 'Provider details are currently unavailable.'
                        : 'No preferred provider has been assigned yet.'}{' '}
                    For urgent property-service help, find a local provider and confirm availability
                    directly.
                  </p>
                  {(realtorPhone || realtorEmail) && (
                    <a
                      href={
                        realtorPhone
                          ? `tel:${emergencyPhoneHref(realtorPhone)}`
                          : `mailto:${realtorEmail}`
                      }
                      className="inline-block text-xs font-semibold text-[#8a6b3d] underline mt-3"
                    >
                      Ask your Realtor for a recommendation
                    </a>
                  )}
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
