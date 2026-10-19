# Home Reminders — Phase 1

Local implementation only. No migration, extensions, secrets, Cron, functions or frontend have been deployed by this change.

## Scope

All Free/Core/Pro public hubs include independent homeowner-controlled schedules for HVAC/filter (chosen first date and 7–730 day interval), monthly maintenance (first day of month), and seasonal maintenance (March/June/September/December 1). Homeowners select an IANA timezone and delivery time, defaulting to their browser timezone and 10:00. Allowed delivery times are 09:00–19:00. Seasonal copy is broadly applicable to the current US launch; no weather/location inference is performed.

No homeowner Auth accounts. No checklist due dates/completions are uploaded, and checklist completion does not reset these schedules. No contacts, addresses, names, email, insurance information, or analytics device IDs enter this system. No travel reward reminders.

## Storage and authorization

`close_relax_private.homeowner_push_subscriptions` stores immutable profile ID + canonical hub origin, encrypted subscription (AES-256-GCM), unique endpoint SHA-256 hash, SHA-256 management capability hash, confirmation hash/expiry, status, timezone/time, consent version/date and VAPID public-key fingerprint. Subscription endpoints and encryption keys are not logged or returned by management APIs.

`homeowner_push_reminders` stores exactly three kinds with enablement, independent next due date/interval and revision. `homeowner_push_deliveries` is the durable outbox with unique occurrence key, states, attempts, expiring lease token and minimal error codes. `homeowner_push_rate_limits` contains short-lived salted bucket hashes, not raw IPs. Rate buckets expire after two hours. Delivery history expires after 30 days; pending enrollment expires after one day; invalid/revoked bindings have encryption material erased and are purged after 30 days. Explicit unsubscribe deletes the subscription and cascades its schedules/deliveries immediately.

All four tables have RLS, no anon/authenticated table grants, and live in an unexposed schema. No new homeowner or Realtor policies. Five narrow public-schema RPC wrappers are executable only by `service_role`; they use fixed empty search paths. The manage RPC also checks capability and canonical published profile. User/profile metadata and plan values are never authorization sources.

The browser stores its random UUID and 256-bit management capability in origin-scoped IndexedDB: database `closeandrelax-push-v1`, object store `settings`, key `installation`. It also stores its own preference snapshot, endpoint, profile binding and public API configuration for service-worker reconciliation. The same store's `manifest` key contains public Realtor branding. No homeowner localStorage keys are changed. Losing this browser storage loses management access; a new enrollment first unsubscribes any unmanaged browser subscription before creating a fresh one. Existing server endpoints cannot be taken over without their capability.

Enrollment requires explicit consent and notification permission from the Enable click. Server validates the published profile and origin together (the Origin header is not authorization). It encrypts the subscription and sends a visible welcome with a short-lived random challenge. The worker can activate recurring delivery only when it possesses the matching installation credential and receives that encrypted push. A successful welcome confirmation counts against frequency limits. Confirmation is idempotent. Enrollment/management are limited per installation and salted network hash, with an additional shared enrollment limit per hub. The latter is 120/hour and should be monitored for legitimate growth or denial-of-service pressure. Origin-level limits remain effective even if a caller spoofs/rotates network headers.

Only HTTPS FCM `/fcm/send/`, Mozilla `/wpush/v2/`, and Apple `*.push.apple.com` endpoints are accepted. Custom ports, user credentials, query strings and fragments are rejected. Sending uses a pinned `web-push@3.6.7` library to create encrypted/signed requests and `fetch(redirect: 'error')` to prevent redirect abuse. Adding another push provider requires a reviewed allowlist change. Never enable the transport dependency's `ECE_KEYLOG` setting in production.

No subscription listing API or Realtor access is provided. The platform has operational counts, not a homeowner activity dashboard. Do not expose `close_relax_private`, `vault`, `cron`, or `net` via the Data API.

## Exact database functions

Service-only public RPCs: `public.homeowner_push_manage(jsonb)`, `public.homeowner_push_rate_limit(text,integer)`, `public.homeowner_push_claim()`, `public.homeowner_push_finish(uuid,uuid,text,timestamptz,text)`, and `public.homeowner_push_send_allowed(uuid,uuid)`. The private calendar helper is `close_relax_private.push_next_due(text,date,date,integer,text,time)`. New due-work indexes are `homeowner_push_due_idx` and `homeowner_push_work_idx`, in addition to primary/unique constraint indexes. No existing policies, triggers or functions are replaced.

## Scheduling and delivery

Migration `20261018171924_homeowner_push.sql` creates only private push objects/service-only RPCs. It does not enable extensions or install Cron. It selects due work in transactional batches using an advisory transaction lock, row locks and `SKIP LOCKED`. Delivery claims have five-minute lease tokens; stale acknowledgments cannot complete a newer lease. Check active/published/canonical hub again immediately before sending. Preference changes cancel queued/leased old payloads. Unpublishing or a slug change pauses the old origin instead of redirecting it to another hub.

The dispatcher drains at most 500 jobs per invocation in batches of 25/five concurrent sends, with a bounded runtime budget. Run every 15 minutes. Timestamp conversion uses PostgreSQL IANA timezone rules; calendar dates retain the selected wall time across DST. It sends at most one occurrence per local day and two in a rolling seven-day window, combining coinciding types. Retries count the same occurrence, not a new reminder. Stale occurrences and those suppressed by a cap advance to their next cycle rather than accumulating a backlog. Reminder TTL is six hours; sends/retries outside 09:00–19:00 are expired. These are useful routine check-ins, not guaranteed or emergency delivery.

404/410 disable the binding and erase encrypted delivery credentials. 429 honors Retry-After; network/5xx use exponential backoff plus jitter, at most five attempts and never past occurrence expiry. 401/403 or changed VAPID key fingerprint record an operational auth error and pause affected subscriptions without deleting them. Auth errors stop further batches and produce HTTP 503/counts for monitoring. Re-enrollment is required after a key change; do not rotate VAPID keys casually. Preserve the encryption key; loss prevents decryption. No automatic key rotation is implemented in Phase 1.

Push-service acceptance is not delivery confirmation. Exactly-once display is impossible after an ambiguous network failure; stable notification tags reduce duplicate display. A send already in flight cannot be recalled by unsubscribe. Lease interruption/retry, browser invalidation and expiration are expected lifecycle cases.

## PWA and device behavior

`/sw.js` has root scope on each Realtor origin and no app-shell/offline cache. The only fetch interception is `/manifest.webmanifest`, to return public Realtor-specific branding from IndexedDB at a stable URL. Static fallback PNGs/manifest are shipped; Pro initials and existing Apple icon rules remain. Manifest identity, `start_url` and `scope` are `/`; tracking queries never enter the start URL. Existing installations with older query-dependent identities may need reinstalling. Test that upgrade on real devices before rollout.

Push always displays a visible, approved generic message. Payloads contain no homeowner PII or management credentials. Click handling accepts only the same-origin checklist target and otherwise uses the same-origin reminder settings target. It focuses/navigates an existing root hub window or opens one. Normal published-profile RLS still applies. No arbitrary click URL or another profile ID is accepted.

Foreground open/visibility return reconciles permission/subscription state; `pushsubscriptionchange` is a best-effort supplement. An offline opt-out immediately unsubscribes the browser and retains a pending server revocation credential, retried on next online visit. No browser permission is requested automatically. Private dashboard preview prevents registration, IndexedDB, permission and management side effects.

Android Chrome can enable directly where supported; installation is optional. iOS/iPadOS 16.4+ requires a Home Screen installation and a direct tap within it. Unsupported browsers keep the checklist usable. OS notification permission/Focus and connectivity can delay or prevent delivery. Each installation/hub is independent: no physical-device fingerprint, cross-hub deduplication, or automatic cross-device preference/checklist sync.

## Required configuration — do not put values in source/chat

Vercel Production public variable:

- `VITE_WEB_PUSH_VAPID_PUBLIC_KEY` — base64url public VAPID point, included at build time.

Supabase Edge Function Secrets:

- `WEB_PUSH_VAPID_PUBLIC_KEY` — same public key.
- `WEB_PUSH_VAPID_PRIVATE_KEY` — corresponding base64url private scalar.
- `WEB_PUSH_VAPID_SUBJECT` — monitored `mailto:` contact or HTTPS contact URL.
- `WEB_PUSH_SUBSCRIPTION_ENCRYPTION_KEY` — 32 random bytes, base64url encoded; back up securely.
- `WEB_PUSH_CRON_SECRET` — dedicated high-entropy scheduler secret (at least 32 characters).
- Existing platform-provided `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` remain server-only.

Vault, created securely through approved configuration:

- `homeowner_push_project_url` — `https://hphcejnvxyccmwmofdqc.supabase.co`.
- `homeowner_push_cron_secret` — same value as `WEB_PUSH_CRON_SECRET`.

No values or production keys have been generated/inserted. No Resend, Firebase project or Apple developer membership is required. The VAPID public key is intentionally public; all other credentials above stay server-side. Supabase's `pg_net` queue temporarily contains request headers, readable by trusted database login roles. A dedicated scheduler secret limits its authority. Keep `net` unexposed and review trusted DB login roles; Vault does not encrypt the in-flight HTTP queue.

## Validation

- `pnpm test` / `node --test tests/*.test.mjs`: existing regressions, actual migration execution in isolated PGlite, private table/RPC access denials, capability/hub isolation, DST/leap/seasonal dates, outbox/leases/deduplication, frequency, invalidation, browser support, UI interaction and preview suppression.
- `deno check --config supabase/functions/deno.json supabase/functions/homeowner-push-manage/index.ts supabase/functions/homeowner-push-dispatch/index.ts`.
- `deno test --allow-env=ECE_KEYLOG,NODE_DEBUG --config supabase/functions/deno.json tests/homeownerPushTransport.deno.ts`: pinned transport encryption/signing under Deno; network intercepted; public mathematical fixtures only.
- `pnpm build`. In a filesystem sandbox that blocks esbuild's parent-directory config discovery, equivalent `vite build --configLoader native` can be used.

Local tests do not emulate Apple/Google push delivery, actual mobile permission prompts, Vercel wildcard hosting, pg_cron/pg_net workers, or production Data API exposure. Real-device staging checks remain a release gate.

## Safe production sequence (each step requires approval)

1. Review/commit the feature on `codex-development` after local checks. Do not merge yet. Confirm the target project and capture existing RLS/function/trigger definitions for comparison. Confirm private/net/vault/cron schemas are not Data API exposed.
2. Approve/apply only the push migration; verify grants, RLS and service-only RPC access. Do not apply the unrelated retired-emergency cleanup migration as part of this release.
3. Generate the VAPID/encryption/scheduler credentials securely, configure the exact Edge/Vercel/Vault variables above, and verify names/public-key correspondence without echoing values. Set up operational monitoring/alerts for dispatcher errors and auth failures.
4. Deploy only the two push functions with `verify_jwt=false`; their handlers enforce capability/scheduler authentication. Verify unauthorized requests fail and no listing operation exists. Do not enable Cron yet.
5. Deploy/test the frontend, stable manifest and worker on an approved published staging hub, using isolated credentials/project configuration. Test real Android and iPhone installation, user-gesture permission, visible confirmation, disable/re-enable, clicks, subscription change/invalid endpoints, private preview and older installed-app upgrades. Never use a live homeowner's subscription for testing.
6. After staging passes, approve the production frontend merge/deployment with the public VAPID variable in place. Use an explicitly opted-in controlled production test installation for a final smoke check.
7. Approve/run `supabase/setup/homeowner-push-cron.sql` once: it enables `pg_cron`/`pg_net`, requires verified Vault configuration and creates exactly one `*/15` dispatcher job. The script refuses a duplicate job. These extensions are not currently enabled in production and require this separate approval.
8. Verify Cron runs, aggregate health, frequency/deduplication, and invalidation. Confirm existing vendor limits, public profile/insurance RLS and unrelated objects match the before snapshot. Stop the named Cron job if dispatch fails; retain subscriptions for recovery rather than deleting data.

References: [Supabase scheduled functions](https://supabase.com/docs/guides/functions/schedule-functions), [pg_net access constraints](https://supabase.com/docs/guides/troubleshooting/revoking-access-to-pg_net-objects-has-no-effect-0bbc16), [WebKit Home Screen Web Push](https://webkit.org/blog/13878/).
