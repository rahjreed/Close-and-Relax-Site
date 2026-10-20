# Close & Relax pre-Stripe security release

**Prepared package, not deployment approval.** Target production project:
`hphcejnvxyccmwmofdqc` (Close & Relax). No Stripe work, Auth changes, history repair,
secret changes, migration application, deployment or scheduler activation is
performed by preparation/validation. Emergency Services retirement and Home Reminders
activation are excluded. Do not use `supabase db push` on the repository directory.

## Exact source and offline package

Application/Edge base revision: `c029ccc57ccab6f683336ffebe242d779834db26` on
`codex-development`, plus the explicitly listed **uncommitted closure overlay** in
`manifest.frontend.working_tree_overlay`. The hashes describe this local working
tree, not an already committed or deployed revision. This review adds authenticated
manual closure requests and the corresponding privacy explanation; the ten SQL
migrations and six historical sources are unchanged. Commit/review this exact
frontend and updated `support-contact` source together before release. Deploy the
updated Edge Function before its matching frontend: the previous endpoint would
ignore the new closure request type instead of enforcing account identity.
Staging closure acceptance remains a release gate; offline tests do not replace it.
A later app/backend modification requires a newly reviewed manifest, hashes,
rehearsal and build; do not silently update hashes to pass a gate.
`manifest.json` pins every frontend file and the matching Edge source/configuration
using UTF-8 SHA-256 after CRLF→LF normalization. It is not a signature or a claim
that these sources are already deployed. Protect/review the manifest like source.

Offline check (no network, DB connection or write):

```powershell
node tools/prepare-pre-stripe-release.mjs
```

Stage a **new** directory outside the source migration directory:

```powershell
node tools/prepare-pre-stripe-release.mjs --out <new-local-package-directory>
```

The staging tool refuses overwrites and checks the exact ten-entry order, hashes,
dependency order, six historical aliases and frontend/Edge fingerprints. It copies
only the selected SQL plus the manifest/read-only checks/runbook. It does not
execute SQL or provide an automatic production runner. A staged bundle is for
explicit reviewed application; it is not a new Supabase project for `db push`.

## Historical mapping — already applied, NEVER replay

Live history was rechecked read-only on 2026-10-19. These six production versions
and names are the authoritative baseline; local files are retained historical
source with different filenames. Hashes in the manifest freeze that local source;
they do not prove the complete historical production SQL was byte-identical.

| Local source version | Production version | Name |
| --- | --- | --- |
| 20261012000000 | 20261015163221 | update_preferred_vendor_limits |
| 20261016021806 | 20261016023454 | emergency_services |
| 20261016033634 | 20261016043104 | homeowner_savings |
| 20261016054605 | 20261016060341 | insurance_funnel |
| 20261017025446 | 20261017034234 | insurance_structured_address |
| 20261018171924 | 20261018212856 | homeowner_push |

Do not run migrations merely because their local version is absent from live
history. Do not mark them reverted, rename historical SQL, rerun table creation,
or use `migration repair` as part of this package. Catalog/definition preflight
and the alias mapping resolve execution selection without modifying history.
Unexpected live versions/names require a stop and reconciliation review.

`production-history-observed.json` records only the project reference and six
version/name pairs from the read-only inspection, never rows or secrets. It is a
dated snapshot, not a live readiness guarantee. Export fresh history metadata in
the same shape immediately before rollout and compare offline with:

```powershell
node tools/prepare-pre-stripe-release.mjs --history <fresh-history-json>
```

That initial-history gate deliberately fails during a partial/completed rollout;
resume requires the separately recorded per-file checkpoint aliases and catalogs,
not editing the baseline snapshot to silence a mismatch.

For the ten new applications, record the source version, normalized hash, tool,
actual production-assigned version, timestamp and result in a restricted release
record. An API such as apply_migration may assign a new timestamp; record that
alias rather than assuming the source version was retained. On resume, reconcile
the record with live history and catalogs; never rerun an already successful SQL
file blindly. Future CLI automation requires a separate approved history/baseline
strategy. This package intentionally does not rewrite the existing history.

## Exact database order

1. `20261019025425_restrict_standard_vendor_helper.sql`
2. `20261019032658_enforce_profile_branding.sql`
3. `20261019034056_enforce_vendor_downgrade_visibility.sql`
4. `20261019035914_support_inbox.sql`
5. `20261019172710_bootstrap_realtor_profile.sql`
6. `20261019175354_deprecate_legacy_realtor_profiles.sql`
7. `20261019180243_enforce_realtor_slugs.sql`
8. `20261019181529_harden_vendor_updated_at_search_path.sql`
9. `20261019183523_restrict_hub_activity_ingestion.sql`
10. `20261019200249_realtor_signup_owner_notifications.sql`

The helper ACL is first; branding precedes vendor projection and analytics;
bootstrap follows the new profile/vendor boundary; signup outbox follows bootstrap.
Support relies on the historical private admin allowlist. Slug validation precedes
analytics' canonical hub-origin behavior. Keep each file's transaction boundaries.

**Never include `20261018151224_retire_emergency_services.sql`.** Emergency tables,
six categories, assignments and their publication policy remain. Branding is
allowed to update that policy's predicate. Dropping the table before branding
would make step 2 fail. No migration SQL needed modification once execution is
selected explicitly; optional retirement remains a separate future approval.

## Frontend/backend compatibility

| Change | Old behavior that stops working | Matching release requirement |
| --- | --- | --- |
| Branding (2) | Public raw `profiles.select('*')` loses public SELECT | Frontend uses `get_public_realtor_profile`; never restore raw public reads |
| Vendors (3) | Public raw vendor queries return no public rows | Frontend/private preview use `get_hub_vendors`, including authoritative empty Pro results |
| Bootstrap (5) | Browser profile INSERT is revoked | Frontend uses retryable owner-only `bootstrap_own_profile` |
| Analytics (9) | Direct public INSERT is revoked | Frontend uses `record_hub_activity`; cached clients may lose telemetry |
| Support (4) | Old fake-success form is unacceptable | Private table/RPC + salt/Turnstile + `support-contact` + matching receipt-aware frontend |
| Notifications (10) | No old browser hook is used | Outbox + `signup-notifications` worker + server secrets; schedule later |

The new frontend also cannot be deployed **before** these RPCs exist: it fails
closed instead of falling back to insecure raw access. Use a coordinated maintenance
window. Old already-open tabs cannot be recalled: ask Realtors to refresh, expect
old public tabs to require reload and old telemetry to be dropped. Do not weaken
RLS/grants to support cached clients. Do not approve the rollout if no way exists
to manage the incompatible frontend/database interval.

Do **not** redeploy `goosehead-lead`: production version 3 already has structured
addresses and the intended security checks. The manifest fingerprints its local
source so accidental edits are noticed; staging tests verify its RPC boundary is
unchanged. Deploy only the two new functions at the approved phase.

## Rehearsal and acceptance gates

Run `node --test tests/preStripeRelease.test.mjs`, then the full test command and
the production build. The integrated test constructs an isolated PGlite baseline
from read-only production catalog shapes/functions/policies/triggers, applies the
six **historical** feature files only to that empty test database, seeds synthetic
accounts/content, and applies all ten selected migrations in order. No production
data, key, real session, external mail, CAPTCHA request or network scheduler is used.
The core baseline uses simplified Auth helper/session stubs; it is not a hosted
Supabase clone. Storage/SMTP/gateway/Edge runtime/production hosting are not emulated.

Automated integrated acceptance covers:

- Exact package inventory/hash/order checks and fresh SQL replay; no historical
  migration or optional cleanup enters the deployment bundle.
- Cross-account denial, plan spoofing, unpublished public denial, own draft vendor
  preview, public field redaction, canonical/invalid slugs and raw API denial.
- 30→15→5→30 visibility, privately preserved rows/notes, standard-resource behavior,
  legacy branding preservation, checklist/custom content retention and Pro restore.
- Eight competing last-slot requests, one accepted. **PGlite serializes a single
  connection: this is not proof of real PostgreSQL multi-session lock behavior.**
- Actual bootstrap RPC, idempotent Free profile recovery, one outbox event and
  service-only notification claim/acknowledgement without sending email.
- Support idempotent receipt, admin list/status, ordinary/anonymous denial.
- Published analytics acceptance/dedupe, unpublished/direct-write/cross-owner denial.
- Insurance direct/referral, hidden/draft referral denial, home-address requirement,
  auto without address, admin statuses and five/hour limit.
- Unchanged insurance/push/admin/plan-limit/Pro-restore function bodies and ACLs;
  emergency category/assignment retention, dormant push tables and no scheduler.

**Hosted/native staging gates still required before production approval:**

1. Use a disposable staging Supabase/PostgreSQL environment, with synthetic data
   and equivalent roles/grants/constraints/triggers; review differences from the
   captured baseline. Never seed production users or copy secrets unreviewed.
2. Apply the same selected package, run preflight/postflight, deploy the pinned
   frontend and only the two new functions with staging-only configuration.
3. In two independent authenticated DB transactions with the same Free test owner
   and four saved custom vendors: A inserts a fifth and holds its transaction;
   B starts another insert and must wait for the parent lock. Commit A; B must
   reject over-limit and leave exactly five. Repeat with A rolled back: B should
   succeed. Repeat against a concurrent plan downgrade and public visibility.
   Do not substitute Promise.all on one DB connection for this gate.
4. Browser/API test owner versus another Realtor and anon, draft preview effects,
   legacy aliases, publication, public profile/vendors, all tiers, mobile/PWA,
   bootstrap recovery and account settings. Verify other-owner rows are not returned.
5. Use staging Turnstile/approved hostname and mocked/test mail destinations for
   endpoint checks. A real email or lead test requires separate explicit approval;
   this preparation task sends neither. Confirm actual Resend delivery and sender
   quota, not just provider acceptance; confirm Support manual replies/fallback.
6. Verify no push function/job/permissions/config became active. Capture evidence
   and record each gate's result and operator before declaring production GO.

## Production rollout — exact order after separate approval

0. **GO/NO-GO checkpoint:** all staging gates pass; validate manifest/fingerprints;
   confirm project, history aliases, live schema drift and approved artifact SHA.
   Verify current deployable frontend contains no later billing/push work. Capture
   current frontend deployment ID, insurance function version, catalog/grant/policy
   snapshots and a verified backup/recovery option. Export/checkpoint any business
   data under the approved access/retention policy, without exposing it in Git/chat.
   Confirm maintenance-window mechanism and rollback/forward-fix owner. No GO if
   recovery or compatibility handling is unavailable.
   This task leaves the package uncommitted and the three app commits local-ahead;
   separately approve source review/commit/push/release-branch handling. Have the
   exact matching frontend artifact built and deployable before the DB window.
   A later merge/package commit may have a different Git SHA only if every pinned
   application/backend file still matches; otherwise generate/review a new package.
1. **Secure configuration:** configure only Support salt and signup-worker Resend
   key/sender/recipient/strong bearer secret. Reuse existing Turnstile secrets
   without changing them. Set `SIGNUP_NOTIFICATIONS_ENABLED=false`; do not create
   a scheduler or Vault/Cron job yet. No Auth provider/SMTP/template changes.
   See `docs/support-inbox.md` and `docs/signup-owner-notifications.md`.
2. **Database:** in the coordinated window, run the read-only preflight, then apply
   exactly steps 1–10 above, one at a time, recording each actual migration version
   and hash. Stop immediately on error; inspect live history before any retry.
   Keep Emergency Services intact. Run postflight before continuing. No db push,
   history repair, opportunistic cleanup or push activation.
3. **Edge Functions:** deploy the pinned `support-contact` and
   `signup-notifications` sources/config. Public support keeps its CAPTCHA/origin/
   rate-limit boundary; the worker keeps its custom server-only bearer check.
   Worker remains disabled and unscheduled. Do not deploy/change `goosehead-lead`.
4. **Frontend:** deploy the pinned matching frontend with existing public Supabase
   and Turnstile variables and the approved fallback. No owner mailbox, worker
   secret, Resend key, service-role key or VAPID variable goes in Vite. Verify the
   actual deployed revision/build environment, not just this local build.
5. **Read-only smoke checkpoint:** verify published/draft/invalid hubs, profile and
   vendor RPCs, owner and other-account isolation, admin discovery, loading/error
   behavior, new function unauthorized responses and disabled worker behavior.
   Run postflight/catalog checks and Security Advisor. No live test submissions
   without an explicit test-data authorization. Gate failure keeps Stripe blocked.
6. **Approved operational acceptance:** with explicit permission use a disposable
   test Realtor/Support submission, verify one standard vendor, correct Free plan,
   private inbox delivery and no duplicates/PII telemetry. Complete real-device
   Auth/preview/PWA and insurance smoke checks without unapproved lead creation.
7. **Separate notification activation:** after core release acceptance, review
   Resend quota/verified sender/owner mailbox and configure the signup-only Vault
   values if Cron is the chosen scheduler. Approve pg_cron/pg_net if needed; neither
   is enabled by this package. Enable worker, then run only the separately reviewed
   `supabase/operations/schedule_signup_notifications.sql`. Never activate a push job.
   Existing-profile tombstones must remain ignored; review any legitimate queued
   profiles created after the DB migration before enabling sends. Verify counts,
   idempotency and actual delivery with approved test data. Scheduler failure does
   not roll back or block core account creation.
8. **Release closeout:** record final frontend/Edge/migration versions and results,
   monitor bootstrap/profile/vendor/support failures and notification queue health.
   Only after the core authorization/entitlement gate is verified may Stripe begin.

## Rollback checkpoints — preserve security boundaries

- Before DB application, keep the old deployment artifact available. Since the new
  frontend expects new RPCs, it cannot be an isolated frontend-first rollback test.
- Each multi-statement SQL file is transaction-wrapped; timestamp hardening is one
  atomic ALTER. A failed file should roll back its own changes, **not earlier
  successfully committed files**. Confirm actual outcome/history before resuming.
- After branding/vendor/bootstrap/analytics boundaries change, the old frontend is
  incompatible. **Do not restore old public SELECT grants, open analytics INSERT,
  browser profile INSERT, or helper EXECUTE as a convenience rollback.** Use the
  maintenance window and forward-fix/deploy a compatible security-preserving build.
- Support/notification failures are independent: leave worker disabled, pause only
  its job if activated, and preserve the outbox/inbox for reconciliation. Do not
  reset accepted notification tombstones or retry ambiguous messages blindly.
- A full database restore is a last-resort, separately approved recovery operation
  that can discard newer data and reintroduce vulnerabilities. It is not a default
  rollback script. Review consistency with Auth/Storage/Edge revisions and keep
  unsafe public access blocked until hardening is reinstated.
- No automatic down migration, destructive rollback, Emergency table drop,
  notification activation or production change is supplied by the packaging tool.

## Evidence status

Local integrated rehearsal and full-suite/build results must be recorded in the
task report. No real staging project, production database, function, secret or
scheduler was modified by package preparation. A passing local rehearsal makes
this a reviewable package; production execution still requires the staging gates,
backup/maintenance readiness and explicit approval above.
