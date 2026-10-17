# Insurance funnel cleanup

## Inspection and observed live Turnstile failure

The branch was clean before this work. No structured-address cleanup migration
or frontend fix was present. The wizard still collected one address textarea.
The production schema was inspected read-only: none of the five structured
columns existed, and there were zero leads.

The live insurance page redirects to `www.closeandrelax.com`. An unsent review
session reproduced the generic verification message and Cloudflare warning
**400020**. Cloudflare documents this as **invalid sitekey**:
https://developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/error-codes/

The existing variable name, explicit script URL, compact rendering and
`goosehead_lead` action were already correct. The observed failure happens in
the browser before server-side verification or lead creation; it is not evidence
of a Supabase Secret Key failure. A hostname-authorization failure has a different
code (110200). The saved Vercel value was not inspected during diagnosis. The
owner has since confirmed that the Vercel Production value was verified/corrected
against the current Cloudflare Site Key. The live bundle still needs the
coordinated frontend rebuild/deployment below before verification can be confirmed.

Local changes trim the public key, share a ready-aware script loader, add load
timeouts and retry after transient failure, clear stale error state on success,
retain safe numeric diagnostic codes and distinguish configuration failures from
retryable challenge failures. Expired/error tokens remain unusable. No test-key
fallback or CAPTCHA bypass is introduced. Variable names remain unchanged.

The actual invalid live public-key configuration cannot be repaired solely by
these code changes. It needs a separately approved configuration/build step.
Do not send or commit any secret values.

## Structured private property addresses

Home and Home + Auto now require Street address, City, State and ZIP code, with
optional Apt/Unit. State is a U.S. state/territory/postal abbreviation; ZIP remains
a string and accepts five digits or ZIP+4, preserving leading zeroes. Auto-only
requests discard all property fields. Steps, review and the Edge Function use
the same shared validation. The admin inbox displays each stored part separately.

The new, unapplied migration `20261017025446_insurance_structured_address.sql`:

- Adds `street_address`, `apt_unit`, `city`, `state`, `zip_code` to the existing
  private lead table, with length/state/ZIP/completeness constraints.
- Leaves all historical address parts NULL. It does not guess or split legacy
  address strings; old records retain their address and status-update behavior.
- Requires all mandatory parts for NEW home/combined submissions in the
  service-only RPC. New auto submissions store NULL property fields.
- Derives the existing `address` display value server-side from validated parts,
  rather than trusting a concatenated browser string.
- Extends the admin-only listing RPC with the separate columns.
- Changes no RLS policies, table grants, RPC execution grants, owner allowlist,
  status authorization, referral rules, consent, rate limits, idempotency,
  savings visibility, pricing, vendor limits, emergency services or checklist.

The existing Edge entrypoint already delegates to the shared validator and
forwards its allowlisted result. Its shared dependency is updated; no duplicate
validation or entrypoint rewrite was necessary. Deploy both source files later.

The historical all-NULL address-parts case is intentionally allowed by the table
constraint so old records remain editable. Only the protected creation RPC
accepts public submissions, and it requires full parts on new home/combined
requests. Browser and service roles have no direct table-write privileges.

## Local verification

- Native unit tests cover structured fields, ZIP/state/optional-unit rules,
  auto omission, existing direct/referral/type behavior, loader readiness,
  concurrent loading, failures, timeout/retry and safe error classification.
- Isolated PostgreSQL tests cover independent persisted parts, server-derived
  display address, invalid/missing parts, legacy preservation/status updates,
  referral validation, rate limits/idempotency and unchanged security grants/RLS.
- Mocked Edge tests exercise all coverage types and structured payloads without
  making network requests or touching production.
- React interaction tests cover all wizard steps, review, Back/edit, consent,
  exact action, trimmed key, 400020 diagnostics, transient-error retry, old/new
  admin records, status updates and existing route/tracking behavior.
- A 360px local browser walkthrough verified the required address controls,
  leading string fields, state selection and separate review values. It used
  dummy backend settings and submitted nothing.

## Safe future rollout (approval required)

1. Confirm the valid Cloudflare widget Site Key is saved as
   `VITE_TURNSTILE_SITE_KEY` in Vercel Production. Confirm the widget authorizes
   `closeandrelax.com` (covering www and Realtor subdomains) and corresponds to
   the existing server Secret Key. Do not reveal either value. Do not rotate or
   replace server secrets unless separately required and approved.
2. Prepare/review the new frontend build and source revision without publishing
   it. Keep the new migration separate from previously applied migrations.
3. Coordinate a short release/maintenance window. Apply ONLY the new structured
   address migration to the verified production project.
4. Deploy `goosehead-lead` with the revised `_shared/gooseheadLead.js`, preserving
   JWT configuration and all existing secrets. Then promptly deploy/promote the
   matching frontend built with the corrected public key.
5. The old frontend sends only a combined address and cannot create home leads
   after the new RPC requirement is installed. Do not leave the rollout halfway
   complete. Auto-only remains compatible. If the release cannot finish, restore
   the prior approved RPC/Edge/frontend versions together; do not discard lead
   data or remove security protections.
6. Verify the production widget without bypassing challenges. After separate
   approval, submit deliberate direct/referral test leads and verify all parts,
   admin-only access, status updates and unchanged rate limits.

No production migration, function, frontend or secret changes were made while
preparing this cleanup. The release is prepared on `codex-development`; production
widget verification remains pending the coordinated rollout.
