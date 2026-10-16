# Homeowner Savings and private Insurance Leads launch

The initial Savings migration, owner allowlist membership and Edge Function are
now deployed. The dedicated Home & Auto funnel is a separate, undeployed local
revision; see [insurance-funnel.md](insurance-funnel.md) before any further rollout.

The following records the initial implementation and launch procedure. There is
no email delivery dependency.

## Architecture and access

Homeowner Savings remains a fixed pair of Vivint and Goosehead cards. The
platform-owned public `homeowner_savings_offers` table holds approved destinations;
Vivint is seeded from the existing Realtor Benefits Calendly configuration.
Goosehead always opens the existing public request form; external URL overrides
are rejected for that offer. Free/Core visibility is forced
on by a database trigger and constraint; internal `premier` (customer-facing Pro)
can hide/show the whole section. Pricing, vendor limits, emergency services and
existing profile ownership/plan protection are unchanged.

Lead data lives in `close_relax_private.goosehead_homeowner_leads`, not `public`.
Keep this schema out of the Data API's exposed schemas. Both private tables have
RLS enabled with no direct-access policies or table grants for anon,
authenticated or service_role. Even the Edge role cannot read the lead table.

`close_relax_private.platform_admins` is a trusted allowlist of Auth user UUIDs.
It starts empty. Only a trusted database administrator can provision/revoke
membership; there is no browser write API. Plans, emails, user_metadata and
app_metadata cannot grant administrator access. Deleting the Auth user removes
membership. Each read/update checks the current allowlist, so removing membership
revokes new requests immediately, without waiting for a JWT refresh.

Public security-invoker RPC wrappers delegate to private security-definer
implementations with empty search_path and fully qualified relations:

- `is_platform_admin()` returns only whether the signed-in user is allowlisted.
- `list_insurance_leads(page_size,page_offset)` checks membership on every call,
  returns at most 100 rows, newest first (created_at/id descending), and excludes
  consent/IP hash fields. The dashboard requests 50 rows per page.
- `update_insurance_lead_status(lead_id,new_status)` checks membership and changes
  only the status and its timestamp. Values: new, contacted, qualified, closed,
  not_interested. No endpoint edits contact details or referring profile.
- `submit_goosehead_homeowner_lead(lead,client_hash)` is executable only by
  service_role and only creates/idempotently accepts a lead. It returns a UUID,
  never an existing lead's contents. Anonymous/Realtor callers cannot call it.

Only authenticated users may execute admin RPCs, and non-allowlisted Realtors
receive a server-side permission error. The dashboard's conditional rendering
is a convenience, not the access boundary. Lead data is held in component
memory; no contact data is added to analytics, localStorage, URLs or logs.

## Submission security and attribution

The public `goosehead-lead` Edge Function preserves origin allowlisting, body
limits, the honeypot, required contact consent, shared field validation, Turnstile
action/hostname verification, and salted IP hashing. Database checks enforce a
published referring profile with visible Savings, required fields, allowed
callback windows, current/future callback dates, idempotency by request UUID,
and five submissions per salted IP hash per hour under a transaction lock.

The form supplies the current hub's profile UUID; the database looks up the
Realtor name itself. The admin view shows the current name, with a submission-time
name snapshot as fallback. Unpublishing a profile does not hide existing leads
from admins. Deleting a profile preserves the lead/name snapshot and clears the
foreign key. Realtors gain no access to submitted insurance information.
Attribution identifies the submitted published hub; it is not proof of referral
identity and cannot be used for compensation or authorization.

The only outbound service request is CAPTCHA verification. Notification
recipient/text code, delivery calls, queue/lease/retry function, notification
columns/index, scheduled-job route and email-service secrets were removed from
the un-applied implementation. No Resend API key, sender, retry job or email
provider is needed. No previous version of this migration should be deployed.

## Historical initial production steps

1. Verify production project **Close & Relax**, ref `hphcejnvxyccmwmofdqc`, and
   confirm `20261016033634_homeowner_savings.sql` is still unapplied. Review and
   apply only that revised migration. It creates the Savings objects plus the
   private lead/admin objects; do not separately run an earlier draft.
2. Confirm the platform owner's existing verified Supabase Auth account UUID
   (do not infer it from a Realtor plan or accept a browser-supplied ID). In a
   trusted SQL session provision membership using that verified UUID:

   ```sql
   INSERT INTO close_relax_private.platform_admins(user_id)
   VALUES ('<verified-owner-auth-user-uuid>'::uuid);
   -- To revoke later:
   -- DELETE FROM close_relax_private.platform_admins
   -- WHERE user_id = '<verified-owner-auth-user-uuid>'::uuid;
   ```

3. Configure Cloudflare Turnstile for the production hub domains. Set server
   secrets `TURNSTILE_SECRET_KEY` and a strong random `GOOSEHEAD_RATE_LIMIT_SALT`.
   Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; keep the
   service key server-side. `GOOSEHEAD_ALLOWED_ORIGINS` is optional for explicitly
   approved previews. Configure the public `VITE_TURNSTILE_SITE_KEY` in the
   frontend build. No secrets belong in frontend variables.
4. Review and deploy only the `goosehead-lead` Edge Function with the checked-in
   `verify_jwt=false` config. This permits homeowners without accounts; the
   handler and service-only creation RPC enforce submission protections.
5. Deploy the frontend. Perform an approved test submission, verify its referring
   Realtor and all callback fields in the owner's Insurance Leads inbox, change
   each status, and verify newest-first ordering. Confirm anonymous and ordinary
   Realtor accounts cannot list/update or directly read leads, including leads
   from their own hubs. Confirm Pro hiding, Free/Core locking, unchanged vendor
   limits, CAPTCHA failures and rate limiting. Review Supabase security advisors.
6. Confirm the public privacy notice and internal retention/access process cover
   insurance callback requests. No automated deletion or forwarding is included.

The initial migration, confirmed owner membership and Edge Function were approved
and deployed after the initial implementation. The newer funnel migration and
updated function remain local; follow `insurance-funnel.md` for the next rollout.

## Tracking and local checks

Existing `savings_vivint_click` and `savings_goosehead_click` events record only
CTA/form openings, profile ID, source and the existing random device ID. No
lead submissions or PII are added to analytics.

- `node --test tests/*.test.mjs`
- `pnpm run build --configLoader native`
- Isolated PostgreSQL tests use the inspected live profile protection/RLS to
  exercise lead privileges, allowlist provisioning/revocation, admin status
  updates, ordering, attribution, rate limits, idempotency and visibility.
- React interaction tests and mocked Edge Function tests exercise admin/form UI
  and rejection paths without sending real requests or storing production data.
