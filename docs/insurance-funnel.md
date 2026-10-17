# Public Home & Auto Insurance funnel

The initial funnel migration and function are deployed. The newer structured
address and Turnstile cleanup is LOCAL ONLY; see [insurance-cleanup.md](insurance-cleanup.md)
for the current validation and coordinated rollout requirements.

This document records the original funnel. Its migration and function are now
deployed. Follow the cleanup document above for the newer, unapplied revision.

## Routes and experience

- Share `https://closeandrelax.com/insurance` for ads, QR codes, messages and
  direct outreach. `/insurance/` also works. Vercel rewrites both to the SPA.
- The compact Homeowner Savings card is labeled **Home & Auto Insurance** with
  **Explore insurance options**. It links to the canonical route with `?ref=`
  containing the referring profile UUID. It no longer mounts a lead form.
- The five steps are coverage (home / auto / both), light property details,
  contact information, callback preferences, and review/consent/Turnstile.
- Auto-only does not collect a property address. Back/Continue preserves input
  in component memory. Refresh starts over; no homeowner PII is put in URLs,
  analytics, localStorage or cross-device storage.
- The page uses the existing brand palette and fonts, 48px controls, accessible
  progress/focus handling, and a compact CAPTCHA suitable for narrow screens.
- Existing savings click codes remain unchanged. Unmodified insurance clicks
  wait up to 500ms for tracking before navigation; analytics errors never block
  navigation. Modified clicks retain normal browser behavior.

## Attribution and direct submissions

An absent referral becomes NULL. This is valid for all three insurance types.
Malformed or repeated `ref` parameters are rejected in the UI with a clean
standalone link. The Edge validator checks UUID syntax, then the database checks
any supplied UUID against a published profile whose Savings section is visible.
Unknown/unpublished/hidden profiles are rejected; the code never silently falls
back to unattributed submission. Realtor names come only from the database.

A plain referral is a validated attribution hint, not signed evidence that the
visitor came from that Realtor. It grants no permissions and is not proof for
referral compensation. No Realtor UUID or name is displayed by the wizard.
Authenticated platform admins still see attribution in the private inbox.

## Database migration

`20261016054605_insurance_funnel.sql` is a NEW migration on top of the already
applied Homeowner Savings migration. Do not edit/reapply the original migration.

- Add `insurance_type` to `close_relax_private.goosehead_homeowner_leads` with
  permitted values `home`, `auto`, `home_and_auto`. Existing leads default to
  `home`; all existing contact, callback, consent, status and attribution fields
  remain intact.
- Allow NULL address only for auto-only leads; require a nonempty address for
  home and combined coverage. Auto submissions normalize the address to NULL.
- Replace only the existing private submission/list function bodies: allow no
  referral, validate supplied referrals as before, store insurance type and
  return it to admins. The public RPC signatures stay unchanged.
- Preserve RLS, table grants, function execution grants, the admin allowlist,
  status update logic, transaction-locked five/hour rate limit, salted IP hashes
  and request UUID idempotency. No vendors/emergency/checklist/pricing changes.
- Older home-only callers without `insurance_type` remain compatible.

The shared validator is used by wizard steps and the final Edge handler. The
public `goosehead-lead` function remains creation-only with origin checks,
honeypot, body-size limit, Turnstile token/action/hostname verification, required
consent and private storage. All previously configured variable names remain:
`VITE_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `GOOSEHEAD_RATE_LIMIT_SALT`.
No new secrets or email infrastructure are needed.

## Validation and rollout

- Run `node --test tests/*.test.mjs` and `pnpm run build --configLoader native`.
- Isolated PostgreSQL tests cover legacy row preservation, direct/referral
  submissions, all coverage types, address requirements, invalid attribution,
  rate limits, idempotency, unchanged grants/RLS and admin-only reads/statuses.
- Mocked React tests exercise all five steps, Back/edit, consent/CAPTCHA,
  submissions, compact cards and referral links. Mocked Edge tests retain
  anti-spam/error handling and exercise direct auto/combined submissions.

Do not reapply the original funnel migration. Follow `insurance-cleanup.md` for
the new structured-address migration, matching Edge dependency/frontend release,
public-key correction, and approval requirements. No production changes were
made while preparing that cleanup.
