# Hosted staging preparation

Staging Supabase: `amopxaadnvubvveqpkvu`. All ten selected migrations are
already installed. Do not reapply migrations. No deployment is authorized by
this checklist; obtain separate approval before deployment.

## Frontend configuration

Use a separate Vercel staging project. Configure the environment used for the
actual build (not merely a different Preview/Production environment):

| Variable | Staging value |
| --- | --- |
| `VITE_APP_ENV` | `staging` |
| `VITE_SUPABASE_URL` | `https://amopxaadnvubvveqpkvu.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key from this staging project |
| `VITE_TURNSTILE_SITE_KEY` | Public site key authorized for the approved staging hosts |

Never put server secrets/service-role keys in Vite variables. Verify the
publishable key belongs to staging; the URL guard cannot verify key ownership.

Approved hosts: `staging.closeandrelax.com`, `staging-free.closeandrelax.com`,
`staging-core.closeandrelax.com`, `staging-pro.closeandrelax.com`.
The root opens the app; fixture hosts load their matching saved profile slugs.
Confirm these exact domains are unused before assigning them to staging. Never
move the apex, www, or wildcard production domain. Obtain the required DNS values
from the staging hosting project; preserve unrelated DNS records.

Auth: configure the staging Site URL to `https://staging.closeandrelax.com` and
allow the exact recovery redirect `https://staging.closeandrelax.com/reset-password`.
Review confirmation-email redirects and current Auth/CAPTCHA settings in staging
before submitting test signup/recovery requests. No Auth settings were changed
as part of local preparation.

## Support Edge Function

Deploy `support-contact` only to staging after separate deployment approval,
including `_shared/supportContact.js`, with the existing `verify_jwt=false`.
General Support is public; closure bearer tokens are verified inside the handler.
Keep exact-origin CORS and Turnstile action/hostname checks intact.

Required runtime configuration: `TURNSTILE_SECRET_KEY`, strong random
`SUPPORT_RATE_LIMIT_SALT`, and Supabase-provided `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`. Verify these resolve to staging. Enter secrets only
in the hosting/Supabase secret interface, never in chat or source control.
The Turnstile site key and secret must be a matching pair. Real browser testing
must use the authorized hostname and `support_contact` action.

Signup notifications remain disabled and unscheduled; do not deploy/activate the
worker for this preparation. Home Reminders remains parked. No Cron setup.

## Access blocker

Last verified Vercel state: integration connected, but explicit team access to
`roger-reeds-projects` (`team_4DmeYQFJsRmDgmNg1LLsxfid`) returned 403.
Reauthorize that team; then inspect/create the separate staging project.
Staging project creation was not confirmed. Do not change the live project.

## Deployment and acceptance sequence (after separate approval)

1. Verify Vercel team grant, separate staging project, exact domain assignments,
   HTTPS, staging environment values, Turnstile and staging Auth redirects.
2. Run focused tests/build, then review/update the release manifest deliberately:
   local staging preparation changes its recorded source inventory/hashes.
   Do not silently rewrite hashes to bypass a gate or publish the old dist build.
3. Deploy Support Edge Function to staging, then build/deploy matching frontend
   with staging variables. Record source revision/hash and deployment IDs.
4. Test signup/email confirmation, login, recovery back to staging, logout,
   owner-only bootstrap, and account switching with disposable test accounts.
5. Check Free/Core/Pro fixture hubs, 5/15/30 vendor allowances, published/draft
   results, private preview isolation and no preview analytics/storage effects.
6. Submit a synthetic general Support message and authenticated closure request;
   verify receipts, admin-only inbox/status changes, ordinary-account denial,
   signed-out closure rejection, and no deletion/publication/billing mutation.
7. Verify invalid origin/CAPTCHA/action/hostname rejection; do not weaken checks.
8. Confirm analytics uses record_hub_activity, owner reads are isolated, and
   Savings insurance navigation stays on staging. Insurance submission is not
   cleared until its existing staging Edge/configuration is separately available;
   do not submit real homeowner data or send a real partner lead.
9. Record synthetic row identifiers for approved cleanup. Verify disabled outbox,
   no scheduler and no Home Reminders activation. Document deferred migration 3
   concurrency and migration 6 behavioral testing without marking them passed.

Remaining production links to public legal pages/partner destinations are not
backend staging connections. Avoid navigating them during staging-only testing.
Insurance-page home links also remain outside this limited Support/Auth change.
