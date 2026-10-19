# Reliable Realtor profile bootstrap

## Choice and observed production state

Use an authenticated, idempotent `bootstrap_own_profile()` RPC after session
restoration, confirmation, or login. Do not attach profile creation to
`auth.users` insertion: a profile/standard-vendor failure must not roll back Auth
signup, email confirmation, password recovery, or login. No eager backfill runs.
An Auth record is not necessarily a confirmed/signed-in Realtor.

Read-only inspection on October 19, 2026 found four Auth users, three matching
profiles, and one unconfirmed user without a profile. There were no confirmed
users missing profiles at inspection time. The old client SELECT-then-INSERT
path still allowed an interrupted insert to strand a future authenticated user.

`profiles.id` is the existing primary key; slug has a separate unique constraint
and can be NULL. There is currently no foreign key from profiles.id to Auth.
There is no existing Auth-user profile-creation trigger. Profile plan/branding,
Savings visibility, and standard-vendor triggers remain unchanged.

## Server boundary

- `public.bootstrap_own_profile()` is a no-argument security-invoker wrapper for
  `close_relax_private.bootstrap_own_profile()`, a security-definer function with
  an empty search path and a five-second lock timeout. Only authenticated callers
  receive EXECUTE; neither anon nor service_role receives this owner-only API.
- Authorization uses `auth.uid()` and the signed JWT role, then checks the actual
  Auth row: it must exist, be confirmed, not be deleted, and not be anonymous.
  User metadata is never used as authorization. The Auth row is key-share locked
  during the transaction to exclude concurrent Auth deletion.
- Existing profiles return unchanged, including paid plans, contact details,
  publication, slug and saved branding. Repeated calls do not restore a removed
  Pro standard vendor or edit any owner content.
- A missing profile is created as `partner` (Free), unpublished, with Savings
  enabled and slug NULL. The server copies the Auth email and only bounded string
  fields `full_name`, `brokerage`, and `market_city` from signup metadata. No plan,
  admin flag, publication flag, slug, paid branding, or arbitrary client fields
  are accepted. The browser cannot submit a target profile UUID.
- The primary key plus `ON CONFLICT (id) DO NOTHING` ensures retry/concurrent
  requests cannot create duplicate profiles or overwrite the winning record.
  Existing profile INSERT triggers create the standard vendor in the same
  transaction. A trigger failure rolls the profile insert back completely.
- Browser table/column INSERT privileges on profiles are revoked. Existing RLS
  policies and owner SELECT/UPDATE permissions remain unchanged. There is no
  browser INSERT/upsert fallback; missing RPC, errors, or outages fail visibly.

## Client recovery

The client calls the RPC once per active account load, deduplicating in-flight
calls. Dashboard content is gated on a ready profile matching the signed-in UUID.
During loading it shows “Setting up your account.” A failed or timed-out request
shows a safe message, Retry setup, Contact Support, and Log Out. It retains the
Auth session and never represents a failed insert as completed setup.

Requests time out after 15 seconds; Retry setup uses the same idempotent server
operation. A lost response can therefore recover a profile that committed before
the connection failed. Account switch/logout/unmount aborts pending work and
discards stale replies. Public homeowner hubs do not invoke the bootstrap. The
password-reset route remains usable independently of profile setup.

## Deletion implications — no deletion feature added

This migration adds no Auth foreign key, cascade, deletion endpoint, or deletion
trigger. Deleting an Auth user currently does not automatically delete a profile.
The RPC rejects a stale/deleted Auth identity rather than recreating its profile.

Deleting a profile already cascades to vendors, homeowner checklist templates,
custom sections, hub activity, legacy emergency assignments, and dormant push
subscriptions. Insurance lead attribution uses ON DELETE SET NULL and retains
private lead data. Homeowner device-local checklist/contact storage is separate.

A future account-closure operation must revoke sessions, explicitly handle
profile/storage cleanup, retained leads, published links, and billing before
deleting Auth. Do not add ON DELETE CASCADE to Auth blindly: it would activate
all downstream deletion paths. Any future FK needs an orphan audit first.

## Validation and production rollout — separate approval required

Tests exercise fresh confirmed signup, older missing-profile recovery, existing
Free/Core/Pro preservation, repeated and concurrent calls, caller isolation,
metadata plan injection, direct-insert denial, standard-vendor rollback/retry,
client errors/timeouts/retry, cancellation, and late account-switch replies.
PGlite executes concurrent client calls on a single database connection; actual
multi-connection MVCC races rely on PostgreSQL's primary-key/ON CONFLICT guarantee.

1. Review/apply `20261019172710_bootstrap_realtor_profile.sql` only after approval.
   It assumes the existing `close_relax_private` schema and profile/vendor triggers.
2. Deploy the matching frontend in the same release window. Old clients can still
   load existing profiles, but their missing-profile INSERT path will be denied
   once the migration revokes INSERT. Do not leave that mixed revision running.
3. With approval, test a real confirmed account with no profile, a repeat bootstrap,
   two parallel authenticated connections, and an existing paid account. Verify
   exactly one Free draft/standard vendor for a new user and unchanged paid data.
4. Unconfirmed Auth users will receive profiles only after confirmation/login.
   No manual backfill is required for normal recovery; do not backfill paid plans
   from signup metadata. An outage/trigger error must be resolved before retry
   can succeed; the UI does not silently bypass server protections.

No migration, production backfill, deployment, Auth configuration, or deletion was
performed during local implementation.
