# Owner signup notifications — local implementation, not deployed

## Choice and event meaning

Use the existing Resend service via its HTTPS API for an owner-only transactional
email. No SMS service, new paid dependency, browser call or frontend setting is
introduced. Existing Resend **SMTP configuration does not automatically give an
Edge Function API access**; configure a sending API key separately and verify the
sender domain/quota before rollout. Auth SMTP/templates remain unchanged.

The event is a confirmed, non-anonymous Auth identity's **first successful Realtor
profile creation**. The owner-only `bootstrap_own_profile()` RPC runs after email
confirmation/sign-in; new profiles start Free (`partner`), unpublished. A raw Auth
signup still awaiting confirmation is not a usable Realtor profile and sends no
owner notification. An existing Auth user who first recovers/creates a missing
profile after rollout qualifies once. This is intentionally not an alert for every
Auth row insertion, repeated signup attempt or browser “Check your email” response.
It is not delayed until publication. Publication and plan changes do not alert.

The email has a constant subject and plain text only: original Auth signup time
(UTC), profile creation time (UTC), bounded Realtor name, Auth account email,
profile UUID, actual internal plan and publication state at the first delivery
attempt. It excludes password, token, arbitrary Auth metadata, phone/address,
insurance/support records and all homeowner data. Name is optional basic profile
text, never an authorization claim. State is a snapshot, not a billing statement.

## Database and failure isolation

Migration `20261019200249_realtor_signup_owner_notifications.sql` depends on the
existing `close_relax_private` schema and the local bootstrap/plan protections.
It adds only:

- Private RLS-enabled `realtor_signup_notifications` outbox keyed by Auth/profile
  UUID. No direct grants/policies for anon, authenticated, or service_role. Existing
  profiles get UUID-only `ignored` tombstones; there is no historical email blast.
- `enqueue_realtor_signup(uuid)` and `queue_realtor_signup()` in the private schema;
  an AFTER INSERT trigger `queue_realtor_signup_notification` on `public.profiles`.
  They validate the actual Auth identity; they do not read raw signup metadata.
- Private claim/finish routines and public security-invoker RPC wrappers named
  `claim_realtor_signup_notifications(text,text)` and
  `finish_realtor_signup_notification(uuid,uuid,text,text)`, executable only by
  service_role. Private definer routines have an empty search_path. Browser/admin
  profile flags do not confer worker/table access.

No HTTP/email runs inside signup or bootstrap. A successful profile insert queues
one row in its transaction. Rollback leaves no event. Normal enqueue errors are
caught with a generic warning so notification failure cannot roll back profile
setup. At the next worker run, a bounded reconciliation (100 missing rows/run)
repairs confirmed profiles missing an outbox row, excluding all tombstones. It
does not modify profiles/Auth or depend on publication. Existing profile/plan,
vendor, support, insurance, RLS and Auth functions are not replaced.

## Delivery, idempotency and retries

The server-only `signup-notifications` worker claims at most five jobs with row
locks / SKIP LOCKED and five-minute leases. Repeated/overlapping worker calls do
not normally claim the same job. Each attempt has a new lease UUID; stale/foreign
acknowledgements cannot finish the job. Lost acknowledgements become retryable
after lease expiry. No anonymous endpoint accepts arbitrary recipients/messages.

The database freezes the entire Resend request, **including sender and recipient**,
on first claim. Updates to profile details/configuration do not change retry
content. Resend receives the same `Idempotency-Key: realtor-signup/<UUID>` on
every retry. SMTP does not provide this worker's delivery path.

Provider acceptance with a message ID is recorded as `accepted`, **not “delivered”**.
The outbox then clears the email payload, retaining the UUID, receipt/status and
timestamps for dedupe/operations. Resend delivery/bounce/suppression events must
be checked in its dashboard if mail does not arrive. No webhook is added.

Transient network/5xx/408/429 errors retry with exponential delay (2 minutes initially,
capped at one hour), at most eight claims. Non-retryable 4xx (including an
idempotency conflict) stop as `failed` for review. A crash/ambiguous provider
success reuses the same request/key after the lease expires. Resend retains keys
for only 24 hours: this implementation stops automatic retries after **23 hours
from the first claim**, including a worker-side age check. An offline scheduler
does not restart that window. Exactly-once end-to-end delivery is not promised.
Never reset a failed row's first-attempt time/key to blindly resend: reconcile
the provider receipt/logs first, since it may already have accepted the email.

Queue errors/HTTP responses contain fixed errors or aggregate counts only, never
addresses, payloads, provider response bodies, Auth metadata or secrets. Invalid
worker authentication fails before any database/provider call. There is no CORS
support; requests with Origin are rejected. The worker has a separate high-entropy
bearer secret and is disabled unless `SIGNUP_NOTIFICATIONS_ENABLED=true`.

No FK cascade deletes the dedupe UUID if a profile is recreated. Deleted/missing,
anonymous or unconfirmed accounts are cancelled before delivery when detected.
A removal racing an already-claimed provider send cannot recall that email.
Coordinate account closure with worker suspension if needed. Failed/retry rows
can contain private names/emails and the configured destination; include them in
the approved privacy/retention review. Clearing payloads and retaining minimal
dedupe UUIDs is preferable to deleting tombstones and accidentally notifying twice.
The current name/email delivery is an intentional limited transfer through Resend
to the owner-controlled mailbox, not an insurance lead notification.

## Required production steps — separate explicit approval

1. Release/review bootstrap and existing security migrations first. Apply only this
   new migration afterward. It creates no extension, scheduler, Vault value or
   delivery and sends nothing by itself. Check RLS/ACLs and ignored baseline rows.
2. In Supabase Edge Function Secrets, set:
   - `RESEND_API_KEY`: sending-only API access for an approved verified sender domain.
   - `SIGNUP_NOTIFICATION_FROM`: a bare verified sender email (no display name).
   - `SIGNUP_NOTIFICATION_TO`: exactly one approved private owner mailbox.
   - `SIGNUP_NOTIFICATION_WORKER_SECRET`: strong random value, at least 32 characters.
   - `SIGNUP_NOTIFICATIONS_ENABLED`: initially `false`, then `true` only for approved activation.
   Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` server-side.
   No `VITE_` variables, Resend key or recipient should be placed in frontend files.
   Do not paste credentials into chat, commit them, or echo them during validation.
3. Deploy only `signup-notifications` with the supplied `verify_jwt=false` config;
   its custom bearer check is mandatory. This does not open a public submission API.
   Confirm missing/wrong secrets get 401/503 and disabled mode touches no queue.
4. Arrange a scheduler. The supplied **operator-only**, non-migration SQL at
   `supabase/operations/schedule_signup_notifications.sql` prepares a five-minute
   Supabase Cron call using pg_cron + pg_net. Neither extension nor job is enabled
   by this change. Approve/enable only those capabilities if absent; alternatively
   use an existing secure scheduler to POST the worker with the same private header.
   The platform/Resend quotas must support the chosen cadence; no paid upgrade is
   performed or presumed. One schedule only, no Home Reminders activation.
5. If using that SQL, securely configure Vault `signup_notifications_project_url`
   as `https://hphcejnvxyccmwmofdqc.supabase.co` and
   `signup_notification_worker_secret` equal to the Edge worker secret. The SQL
   references Vault names rather than embedding credentials in cron.job. Configure
   and verify equality without displaying values. Review/run this operator step
   only after the function/secrets are ready; it is not automatic migration setup.
6. With approval, enable the worker and schedule, then use a disposable confirmed
   staging/approved test Realtor, verify one accepted/delivered owner email, repeat
   bootstrap, and verify no duplicate. No live test email was sent in this task.
   Existing profiles should remain ignored. Failures must not block signup/login.
7. Regularly check the queue counts/oldest work and cron/Edge invocation failures;
   inspect Resend accepted/delivered/bounce/suppression events and quota use. For
   incidents, set the enabled flag false and pause only this cron job. Missing
   secrets/scheduler mean notifications are **not operational**, even if the DB
   groundwork is applied. The worker is not a substitute for the Support Inbox.

Safe aggregate queue inspection (privileged operator only; no payload read):

```sql
SELECT status, count(*), min(created_at) AS oldest_created,
       min(first_attempt_at) AS oldest_attempt
FROM close_relax_private.realtor_signup_notifications GROUP BY status;
```

## Expansion

An SMS channel can later use the same server-generated event/UUID, with its own
recipient configuration, delivery ledger and provider idempotency/consent/cost
review. Do not reuse an email `accepted` flag as proof SMS was sent. No Twilio,
SMS phone number, paid service or SMS dependency is introduced now.

## Validation / limits

Node tests execute the migration with PGlite and the actual bootstrap RPC, including
ACL/RLS, repeated/recreated profiles, queue rollback, failure isolation/reconciliation,
leases, frozen payloads and retry cutoffs. Mocked Resend tests include acceptance,
lost acknowledgement, HTTP errors, authentication and response redaction. PGlite
serializes its connection; staging multi-connection SKIP LOCKED behavior and actual
provider delivery/quotas still need an approved test. No live secrets are inspected.

References: [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys),
[Resend send API](https://resend.com/docs/api-reference/emails/send-email),
[Supabase scheduled functions](https://supabase.com/docs/guides/functions/schedule-functions).
