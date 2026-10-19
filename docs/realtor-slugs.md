# Realtor hub slug rules

## Audit / compatibility

Read-only production inspection on 2026-10-19 found `profiles_slug_key UNIQUE
(slug)` but no slug format/reserved-name protection. The assigned slug was
`rahjreed`; two other profiles had NULL slugs. All are compatible with this
migration. The active profile editor previously transformed input on each
keystroke (lowercase, trim, replace characters and truncate) and reserved only
`www`. It now preserves typed input and explains validation errors instead.

The public wildcard router excludes `www` and nested subdomains. Its profile
loader uses `get_public_realtor_profile(hub_slug)` with exact slug matching and
`is_published=true`, followed by client verification of the returned slug and
publication status. Owner edits use `.eq('id', user.id)` plus database owner RLS.
No other slug-generation path was found; new bootstrap profiles have NULL slugs.
Parked push infrastructure derives its hub origin from the saved slug; it is not
activated or changed here.

## Canonical rules

- 1–63 ASCII lowercase letters, digits or hyphens.
- First and last character must be a letter or digit. Repeated internal hyphens
  are permitted. Spaces, underscores, dots, Unicode, uppercase and line breaks
  are rejected; values are never silently trimmed, lowercased or truncated.
- Reserved exact names are rejected. The complete list is in
  `src/lib/realtorSlugs.js` and `public.is_valid_realtor_slug(text)` in the migration.
  It includes the requested platform names plus account/auth routes, contact,
  pricing/legal routes, common mail/DNS labels and development environments.
  Reservation is exact, so a name such as `support-realty` remains valid.
- NULL is allowed only for an unpublished draft awaiting setup. Empty strings
  are rejected. An assigned slug cannot be cleared to NULL; choose a valid
  replacement instead. Publishing requires an assigned valid slug.
- The existing unique constraint remains authoritative for availability and
  concurrent claims. A duplicate returns SQLSTATE 23505 and the existing editor
  shows “That realtor subdomain is already in use. Please choose another one.”

Changing a slug changes the public hub URL immediately. Saved links, installed
shortcuts, QR codes and shared messages may stop working. Old URLs do not redirect
automatically. There is no alias/history/reservation of released slugs: another
Realtor may subsequently claim a released name. Prefer a stable slug, and update
distributed links after an intentional change. Reserving historical names would
require a separate URL-history feature and migration.

## Database boundary

`20261019180243_enforce_realtor_slugs.sql` adds:

1. `public.is_valid_realtor_slug(text)`: immutable security-invoker validator,
   empty search path, callable by API roles; it reads no data and grants no access.
2. `profiles_slug_canonical_check`: validated CHECK constraint on `profiles`.
3. `public.enforce_profile_slug()` / `enforce_profile_slug_before_write`: invoker
   BEFORE INSERT OR UPDATE trigger providing clear errors and disallowing clearing
   an assigned URL. Direct execution is revoked from PUBLIC and API roles.

No RLS, ownership policy, grant on profiles, unique index, existing function, plan
protection, public projection or other trigger is replaced. Even service/admin
writes must satisfy the canonical constraint. No existing row is rewritten.
The public loader also rejects invalid/reserved names before making its RPC.
Private owner preview still derives identity from Auth, independently of slug.

## Validation / rollout (not performed in production)

Local PGlite tests execute the real migration and the existing public projection
RPC, checking parity with frontend rules, reserved names, length boundaries,
invalid characters, NULL drafts, publication, duplicate claims, owner isolation,
released URLs, unchanged policies and fail-without-rewrite migration behavior.
Existing bootstrap/vendor tests also run with the slug migration applied.

Before applying with separate approval, re-audit production slugs and new DNS/app
routes. The validated constraint deliberately aborts the migration if any existing
slug violates these rules; resolve that with the owner instead of silently
renaming it. Apply the migration and deploy the matching frontend after approval.
Future reserved-list changes must update both SQL and frontend, run parity tests,
and preflight existing assignments. No additional secrets or Edge deployment are
needed. No commit, deployment or production modification was made by this task.
