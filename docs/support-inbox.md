# Support Inbox: local launch preparation

The public support form saves to the private Close & Relax Support Inbox. The
owner agreed to monitor this inbox. There are no automatic email alerts, email
delivery service, queues, or paid dependencies. The administrator can use
“Reply in email app” to respond manually from their chosen support mailbox.

The approved temporary fallback is `mailto:hello@callistadigital.com`. It appears
only after a Support Inbox submission fails, never on the initial form or after
a successful save. It opens the visitor's email app; the visitor must send the
email themselves. Draft contents are not automatically included in the link.
This address does not receive automatic notifications or copies of inbox messages.

## Security and behavior

- `support-contact` accepts POST creation only, with exact-origin CORS for HTTPS
  Close & Relax hosts, Turnstile action `support_contact`, and an exact CAPTCHA
  hostname match. The existing insurance action and function are unchanged.
- Required name/email/message have bounded sizes, a honeypot, server validation,
  and database constraints. Request bodies are limited to 20KB. No payloads,
  tokens, or raw database errors are logged or returned.
- A service-only creation RPC enforces five saved messages per salted IP HMAC
  per rolling hour using a transaction advisory lock. The raw IP is not saved.
  Retrying the same UUID and unchanged content is idempotent; another requester
  or changed content cannot claim that UUID. Editing a draft creates a new UUID.
- `close_relax_private.support_messages` has RLS and no direct table grants to
  anon, authenticated, or service_role. Its public creation wrapper is executable
  only by service_role. Public read/update/delete endpoints do not exist.
- Admin list/status RPCs recheck the existing private platform-admin allowlist
  on every call. Profile/plan/metadata changes do not confer support access.
  No new admins are provisioned. Ordinary Realtors cannot read the inbox.
- Success requires a database-confirmed matching receipt. Failures preserve the
  draft in component memory for retry, including an ambiguous/lost response.
  Closing/reloading discards the draft. Nothing goes to analytics/localStorage.
- Admin messages are newest first, paged 50 at a time; statuses are New,
  In progress, and Closed. Replies are manual and not sent by this application.

## Production steps — require separate approval

1. The frontend defaults to the approved temporary public fallback
   `mailto:hello@callistadigital.com`; no environment change is needed to use it.
   Confirm that mailbox is monitored before launch. To replace it later, set
   Vercel `VITE_SUPPORT_FALLBACK_URL=mailto:support@closeandrelax.com` once that
   mailbox is operational, then rebuild/redeploy the frontend. A nonempty valid
   environment override takes precedence. Only public contact destinations belong
   here; the value is embedded in the public bundle. No production configuration
   has been changed as part of this local update.
2. Apply only `20261019035914_support_inbox.sql` and verify ACLs/RLS against the
   existing private admin allowlist. This migration does not change any existing
   tables, triggers, policies, vendor limits, or insurance functions.
3. Configure a strong random server-only `SUPPORT_RATE_LIMIT_SALT`. Reuse the
   existing Edge `TURNSTILE_SECRET_KEY` and frontend `VITE_TURNSTILE_SITE_KEY`.
   Supabase supplies `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` to the function;
   they must never be added as public Vite variables. Confirm the widget allows
   the actual public hostnames and validates the new `support_contact` action.
4. Deploy only the new `support-contact` function with `verify_jwt=false` (public
   visitors have no account). Server CAPTCHA, origin checks, and service-only
   storage remain mandatory. Deploy the reviewed frontend afterward.
5. With explicit approval, make one end-to-end test submission, confirm it appears
   in the owner's inbox, test a manual reply, and test the independent fallback.
   Confirm a regular Realtor cannot read/update messages.
6. Establish an inbox review cadence and a support-data retention/deletion process.
   No response-time promise is made. No automatic retention job is introduced.

No migration, secret configuration, deployment, or live submission was performed
while preparing this change locally.
