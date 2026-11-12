# Stripe subscription billing — staging review

This branch is a staging implementation, **not approved for production or real
payments**. The server refuses production Vercel deployments, live Stripe keys,
and Supabase URLs other than `amopxaadnvubvveqpkvu`. Billing defaults to disabled.
Do not remove these guards as part of merging this PR without a separate review.

## Architecture and access

The existing React/Vite UI, Supabase Auth and `profiles.plan` mappings are retained:
Free = `partner`, Core = `pro`, Pro = `premier`. The dashboard adds billing controls
inside the existing plan card. Marketing prices remain informational.

Vercel Node functions `/api/billing` and `/api/stripe-webhook` keep credentials
server-side. The browser sends only `action` and public plan name (`core` or `pro`).
The server checks the exact origin, verifies the user with Supabase `getUser`,
requires an existing profile, selects an allowlisted price, validates the sandbox
account/catalog, and binds one persisted Stripe customer to that profile UUID.
The customer record is saved before any subscription Checkout can be created.

New profiles always start Free. Editable Auth metadata cannot grant paid access;
all existing frontend metadata plan fallbacks have been removed. A database
trigger blocks client tier changes even if an existing profile update policy is
broad. Existing admin-assigned plans need auditing before migration rollout.

Billing tables have RLS and no client access. RPCs are security invoker, with
EXECUTE restricted to service_role. Per-account database leases serialize
Checkout and webhook reconciliation. A persisted Checkout attempt keeps its
price, expiry and idempotency key through retries and process crashes. Active,
incomplete, paused, unpaid and past-due subscriptions block a second subscription.
Abandoned Checkout locks the choice for up to 31 minutes; retries reopen the same
session. Expired sessions permit a new attempt.

Verified webhooks fetch current Stripe subscriptions and paid invoices under the
same lease. Event payload order cannot roll back a newer snapshot. The event ID,
billing snapshot and `profiles.plan` update commit atomically; failures return
503 so Stripe retries. Duplicate IDs are ignored. Unknown customers grant no access.

Entitlements come from paid, recognized subscription invoice lines, including
paid upgrade prorations, never the success URL or subscription status alone.
Failed upgrades retain the last purchased tier. Failed renewal and cancellation
retain access through the paid invoice period; scheduled downgrades apply with
the next paid period. Database cron removes expired access within one minute,
even when Stripe is unavailable. Status responses check expiration immediately.
No automatic renewal payment loop is implemented: Stripe Billing owns renewals,
payment retries and invoice collection.

Full refunds, disputes and early fraud warnings put the customer's account on a
durable manual review hold; later invoice events do not silently clear it. Review
the affected charge and subscription before an authorized service/admin operation
clears `risk_hold`. This branch does not send emails or team notifications.

## Founding pricing

Server deadline matches the existing UI: **January 18, 2027, 23:59:59 America/New_York**
(`2027-01-19T04:59:59Z`). Eligibility is reserved when authenticated Checkout starts
on the server, with a 31-minute completion window (Stripe's minimum expiry is
30 minutes). A checkout reserved before the cutoff can finish during that short
window. New attempts after the cutoff use regular prices.

Core: $19 founding / $29 regular; Pro: $29 founding / $39 regular. Once a customer
has had a subscription other than an expired incomplete signup, subsequent new
subscriptions use regular prices. Cancellation followed by restarting cannot
reset this history, including before the deadline. Failed payments alone do not
reprice an ongoing founding subscription. There is no price-increase job.

Separate sandbox Portal configurations were created and read back:

| Cohort | Configuration | Allowed prices |
| --- | --- | --- |
| Regular | `bpc_1Uap07EvcTt943uRZHEZ0Sea` | Core regular, Pro regular |
| Founding | `bpc_1Uap0AEvcTt943uRW1Dna3ni` | Core founding, Pro founding |

Both allow payment-method/address/tax-ID updates, invoices, period-end
cancellation, immediate invoiced upgrades and period-end downgrades. The server
expands and validates the configuration's price allowlist on every Portal visit.
The hosted Portal login page is disabled. Configure Smart Retries and failed
payment emails in the sandbox Billing recovery settings; these were not changed.

## Staging setup still required

1. Restore database query access to Supabase staging. Three minimal schema
   queries through the connector timed out. No staging DDL or data was changed.
2. Inspect `profiles` type/defaults, Auth signup triggers, profile update policies,
   existing SECURITY DEFINER RPCs, vendor limits, checklist/section permissions
   and publication/storage policies. Confirm they enforce the same profile tier
   on the server and cannot bypass the new guard. This audit is **unfinished**
   because staging schema inspection failed. Public hub rendering and data
   exposure on downgrade also require verification against actual staging RLS.
3. Audit existing paid profile assignments; do not bulk reset existing accounts.
   Apply only `supabase/migrations/20261112034500_stripe_subscription_billing.sql`
   to staging after schema compatibility is established. Do not blindly push the
   repository's older migration history into a newly cloned staging project.
   Verify the `close-relax-expire-billing` pg_cron job runs successfully and inspect
   Supabase security advisors. Local PostgreSQL tests verify the migration logic
   but cannot validate Supabase's hosted pg_cron installation or existing schema.
4. Set branch-scoped **Preview** environment variables from `.env.example` on
   Vercel project `close-and-relax-site` / `prj_abmOmkBwOjVFyiqdPdECZFAse89u`, team
   `team_4DmeYQFJsRmDgmNg1LLsxfid`. The frontend staging variables, server Supabase
   URL and two Portal IDs were configured for `feat/stripe-subscriptions-staging`.
   Supply `STRIPE_SECRET_KEY` as a sandbox restricted key and
   `SUPABASE_SERVICE_ROLE_KEY` as the staging server credential using sensitive
   variables. No such server credentials existed in the inspected environment.
5. Set `BILLING_APP_URL` to the exact HTTPS staging/Preview origin. Configure
   Supabase Auth redirect URLs for it. Existing Vercel previews require Vercel
   Authentication: Stripe must have a reachable staging webhook URL. Use an
   approved staging custom domain or an Automation Bypass token in the webhook
   URL, stored privately; do not disable production protection.
6. In **Close & Relax sandbox** `acct_1USR2SEvcTt943uR`, create a snapshot webhook
   endpoint for `https://<staging-host>/api/stripe-webhook`, API version
   `2026-09-30.endive`. Configure only these handled events:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`,
   `invoice.payment_action_required`, `invoice.finalization_failed`,
   `charge.dispute.created`, `charge.refunded`,
   `radar.early_fraud_warning.created`.
7. Store that endpoint's signing secret as sensitive `STRIPE_WEBHOOK_SECRET`.
   Never use a CLI listener secret for a Dashboard endpoint. Set
   `BILLING_ENABLED=true` only after schema and endpoint setup; redeploy Preview.

Recommended restricted Stripe key permissions: Account read (identity guard),
Prices read, Customers read/write, Subscriptions read, Invoices read, Checkout
Sessions write, Customer Portal configurations read and Portal Sessions write,
Charges read (risk event resolution). Provision Portal configs/webhooks separately
with administrative access; runtime needs no write access to them. Confirm these
permissions with a test key before rollout. All secrets belong in sensitive
server variables, never `VITE_`, Git, logs or chat.

## Stripe Tax finding

Sandbox Tax Settings are active with SaaS business-use classification
`txcd_10103001` and exclusive prices. All four existing prices were verified active,
USD, monthly and tax-exclusive. **The sandbox has zero tax registrations.** Actual
paid sandbox invoices returned `taxability_reason=not_collecting`, with $0 tax.
Checkout enables automatic tax and collects billing address and business tax IDs,
but taxable-jurisdiction collection is not verified. Confirm the applicable
registrations with your tax advisor and record confirmed registrations in the
sandbox before testing tax collection; none were added by this work. Sandbox and
live registrations are separate. Next steps: https://docs.stripe.com/tax/set-up

## Validation and evidence

`npm test`, `npm run build`, and `git diff --check` pass. The existing Vite bundle
size warning remains; no unrelated redesign or refactoring was included.

Automated policy and embedded PostgreSQL tests cover authenticated API requests,
origin rejection, arbitrary-price rejection, both tier mappings, deadline and
founding reentry policy, paid-through access, failed payments, persisted Checkout
retry keys, automatic tax parameters, signed/invalid webhooks, duplicate delivery,
out-of-order events, lease contention, renewal, downgrade, expiry, client RLS/RPC
denials and immutable tier assignments. Real sandbox invoice line fixtures verify
the parser against actual subscription/proration data. The pg_cron extension and
Stripe API calls are substituted in local tests; they are not end-to-end staging
tests.

Direct sandbox API tests (separate from the app's blocked staging flow):

| Scenario | Evidence/result |
| --- | --- |
| New Core regular | `sub_1Uap4kEvcTt943uRgxyi0K8L`, initial paid invoice $29 |
| New Pro regular | `sub_1Uap4rEvcTt943uRcjBNxhDU`, initial paid invoice $39 |
| Founding Core | `sub_1Uap4wEvcTt943uRikLvXiUC`, initial paid invoice $19 |
| Upgrade | Core regular to Pro regular; paid $10 proration |
| Downgrade API | Pro regular to Core regular; paid credit invoice; Portal period-end configuration separately verified |
| Cancellation | All three test subscriptions set to cancel at period end and remain active for their paid terms |
| Failed payment | `sub_1Uap6mEvcTt943uRYatJa7iE`, `pm_card_chargeCustomerFail`, subscription incomplete / invoice open |
| Hosted Checkout creation | Sandbox subscription session created with application parameters, automatic tax enabled; no browser payment submitted |
| Tax | Paid invoices: `not_collecting` because registrations are absent |

Clock `clock_1Uap4EEvcTt943uRDLmHKMYE` owns the three successful test customers;
records are retained for review. The failed signup will expire under Stripe's
normal incomplete-subscription handling. No real money moved.

Still required before approving a release: browser signup/login → Checkout payment
→ real signed webhook delivery → staging database → dashboard and public hub;
both Portal cohorts and payment-method updates; scheduled downgrade at renewal;
successful and failed renewal using a test clock; duplicate delivery through the
actual endpoint; taxable address in an active sandbox registration; pg_cron and
RLS/server permission checks on staging; recovery email/retry settings. Do not
describe billing as ready for paying subscribers until these checks pass.
