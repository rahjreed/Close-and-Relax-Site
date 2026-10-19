# Legacy Realtor table retirement

## Read-only audit — October 19, 2026

Production project `hphcejnvxyccmwmofdqc` (Close & Relax) has zero rows in
`public.realtor_profiles`. RLS is enabled, but its public SELECT policy uses
`true`; authenticated owners can INSERT and UPDATE by `user_id`. The anon,
authenticated and service_role roles have all table privileges. There are no
independent column ACLs, triggers, Realtime publications, incoming foreign keys,
referencing views, referencing function bodies, or external policy references.
Catalog dependencies are the table's own type, defaults, constraints and policies.
The legacy `user_id` FK references `auth.users(id) ON DELETE CASCADE`.

Before this change, repository searches (including all migrations, frontend,
public assets and local Edge Functions) found no `realtor_profiles` references.
The only deployed Edge Function, `goosehead-lead` version 3, also has no reference.
The active account flow uses `profiles` and `bootstrap_own_profile()`, and the
homeowner renderer uses the active profiles-based data path. No known current
application/database dependency needs the legacy table. External clients or
dynamically constructed identifiers cannot be ruled out by a source/catalog scan.

## Least-destructive launch treatment

Migration `20261019175354_deprecate_legacy_realtor_profiles.sql` retains the table,
all columns, rows, constraints and history. It:

- Keeps RLS enabled and removes exactly the three inspected legacy policies:
  `Public can view realtor profiles`, `Users can create their own profile`, and
  `Users can update their own profile`.
- Revokes all table privileges from PUBLIC, anon, authenticated and service_role.
- Revokes independent SELECT/INSERT/UPDATE/REFERENCES column privileges from the
  same roles, including any introduced between inspection and application.
- Adds a table comment explaining deprecation and future approval requirements.

With no policies, non-bypass roles also face default-deny RLS if table privileges
are accidentally restored. service_role bypasses RLS but receives no table/column
privileges; database owner/admin access remains available. This is deliberate
retirement of an unused API, not a change to active account authorization.
No global/default privileges, schemas, active profiles policies, functions,
triggers, Auth configuration, vendor limits, or publication rules are modified.

## Local validation

An isolated PGlite fixture reproduces the inspected schema/grants/policies and
demonstrates the original authenticated-write/anonymous-read exposure. Tests then
apply the actual migration, including twice for retry safety, and verify:

- anon, authenticated (own and other identity), and service_role cannot SELECT,
  INSERT, UPDATE, UPSERT, DELETE or TRUNCATE, including column-only requests.
- Table/column privileges are absent and default-deny RLS blocks ordinary roles
  even after temporary grants in the test database.
- Seeded legacy data is retained and active profiles grants/policies and owner
  updates/published-only reads remain unchanged.
- Real bootstrap/standard-vendor regressions run with this lockdown applied.
- Runtime/public/Edge/migration source scans reject new legacy dependencies.

All fixture writes are local only. No production DDL, fixture rows, grants or
policy changes were executed during this task.

## Production and later cleanup

After separate approval, recheck row count/dependencies and apply only this
migration. Verify API-role grants/policies and active signup/bootstrap/public-hub
behavior. A later RLS-enabled-without-policy advisor notice is intentional for
this retired, ungranted table; it is not an exposure. Existing production access
remains unchanged until the migration is approved and applied.

Dropping the table is optional and can wait. If desired, use a separate approved
cleanup migration after a fresh dependency/data audit and backup. Do not use
CASCADE to remove unexpected dependencies. No destructive migration is included.
