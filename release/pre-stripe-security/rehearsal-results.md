# Pre-Stripe release rehearsal results — 2026-10-19

Application/Edge source: `1a1bba663a922e06e32ecf79bc07b901bfb15bb0`.
Release scope: exactly ten new migrations in manifest order. Historical feature
SQL was used only to construct an isolated baseline; never applied to production.
No migration source file, application source, dependency or lockfile was changed
by release packaging. Emergency retirement is excluded and no push runtime added.

## Completed locally

- Manifest validation: PASS (exact order/dependencies, six history aliases,
  normalized SQL hashes, frontend inventory/hashes and Edge fingerprints).
- Offline bundle test: PASS (ten selected SQL files only, historical/retirement
  sources absent, existing output directories cannot be overwritten).
- Integrated rehearsal: PASS, all ten SQL files applied sequentially on the
  production-shaped PGlite baseline. Baseline includes catalog-derived core
  schema, constraints, grants, policies, triggers, functions and public-schema
  default grants; Auth identity helpers and all account/content rows are synthetic.
- Access/isolation, profile projection, all tier caps, downgrade/re-upgrade,
  preserved vendor/profile content, own-draft access, helper denial, bootstrap,
  Support admin boundaries, analytics, notification outbox and insurance: PASS.
- Emergency categories/assignment retained; intended publication-policy change
  works. Insurance/push/admin/limit/restore function definitions and ACLs unchanged:
  PASS. No scheduler extensions/rows or notification delivery activated.
- Eight competing insert requests into the final Free slot: exactly one accepted.
  This test uses a serialized PGlite connection, not independent PostgreSQL sessions.
- Full suite: **140 tests passed, zero failures/skips**. After the final baseline
  grant/cleanup-path refinement, the integrated package suite was rerun separately:
  **10 passed**. No unrelated implementation was changed after the full run.
- Production build: PASS with Vite native config loader. Existing >500KB bundle
  warning remains (about 697.6KB JS, 183.2KB gzip). Build artifact is not deployed.

## Read-only production observations

Target: Close & Relax `hphcejnvxyccmwmofdqc`. History still contains the six
manifested historical entries and no selected launch migration. Read-only
`preflight.sql` returned true for every boolean: retained Emergency tables/six
categories, zero legacy rows, slug preflight, 5/15/30 limits, expected old public
profile/vendor/analytics policies, private insurance RLS/service-only creation and
absent scheduler extensions. Private admin count remains one. No row values,
credentials or secrets are included in this result record.

This is a point-in-time check. Re-run fresh history/schema checks at the actual
rollout; these results do not authorize production writes or certify later drift.

## Not yet completed / production NO-GO gates

- Independent native/hosted PostgreSQL two-session insertion/rollback/downgrade
  contention test. No PostgreSQL/Docker runtime was available locally. A single
  connection cannot establish MVCC behavior under true multi-session contention.
- Hosted staging browser/Edge/gateway/Storage/PWA/Auth acceptance of the coordinated
  release, including cached/old-client compatibility handling.
- Approved real SMTP/Support reply/Resend owner-email delivery tests and quota check.
- Confirmed backup/recovery capability, deployable matching frontend artifact,
  maintenance-window mechanism and operator approvals.

**Verdict:** the selected SQL package is locally replayable and review-ready.
It is not an unconditional production GO. The remaining gates and explicit approval
in README.md are required before executing the production rollout. Stripe stays
blocked until the core production hardening and verification are complete.
