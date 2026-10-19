# Vendor timestamp trigger search path

Read-only production inspection on 2026-10-19 confirmed
`public.set_vendor_updated_at()` is a postgres-owned PL/pgSQL SECURITY INVOKER
trigger function with no function-level search_path. Its entire body is:

```sql
begin
  new.updated_at = now();
  return new;
end;
```

Its only catalog dependency/caller is trigger `set_vendor_updated_at`, enabled
BEFORE UPDATE FOR EACH ROW on `public.vendors`. No other function body or existing
repository file referenced it. Both vendor timestamp columns default to now().
The production Security Advisor reports `function_search_path_mutable` for it.

Migration `20261019181529_harden_vendor_updated_at_search_path.sql` contains one
statement:

```sql
ALTER FUNCTION public.set_vendor_updated_at() SET search_path = '';
```

An empty explicit search_path excludes caller-controlled schemas. PostgreSQL
implicitly searches trusted pg_catalog for the builtin now(), so no body change
or additional qualification is needed. The function reads no tables or sequences.
ALTER preserves its OID, body, owner, invoker security, volatility, return type,
ACL and attached trigger. No CREATE OR REPLACE, grant, policy or other function
change is included. Existing PUBLIC/anon/authenticated/service_role EXECUTE grants
remain: this invoker trigger function cannot be invoked as an ordinary RPC/function
to write data; PostgreSQL rejects calls outside trigger context. No elevated
privilege or unrelated execution permission is added.

Local PGlite tests reproduce the inspected function/trigger, apply the migration
twice, compare metadata and demonstrate that a conflicting public.now() cannot
override timestamp generation through a caller's search_path. Before/after
behavior tests cover default/explicit insert timestamps, normal edits, no-op
updates, multi-row edits and attempts to supply old/NULL updated_at values.
Existing vendor CRUD, plan-limit, standard-vendor and restore authorization tests
also run with the hardened timestamp trigger attached.

Production remains unchanged. After separate approval, apply only this migration
and rerun Security Advisor plus read-only checks of proconfig, owner/ACL and
trigger attachment. No frontend or Edge Function deployment is required. The
warning remains in production until the migration is applied.

Advisor remediation reference:
https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

## Staging verification — October 19, 2026

This follow-up used only staging `amopxaadnvubvveqpkvu`. Production was not
accessed or modified. Fresh staging inspection confirmed the same function body,
postgres owner, invoker execution and sole BEFORE UPDATE vendors trigger. No
other application function body referenced it.

Reused the SQL source unchanged; staging recorded version `20261019233803`, name
`harden_vendor_updated_at_search_path`. The only function difference is proconfig
changing from NULL to `search_path=""`. Function OID 17841, body, owner, ACL,
security mode, trigger OID 17988/definition/enabled state, other functions, all
policies and saved vendor rows are unchanged. No new grants were introduced.

`tests/fixtures/vendor-updated-at-staging.sql` is an operator-only, guarded,
rollback-only acceptance script. It temporarily defines public.now(), supplies
an untrusted caller search_path, and checks explicit INSERT timestamps, normal
edits, supplied old/NULL timestamps, no-op/multi-row UPDATE and direct trigger-call
rejection. All four hosted assertion groups passed, all changes rolled back,
and a new local regression checks the script leaves saved rows unchanged and its
shadow function absent. The pre-existing regressions also verify retry safety,
metadata preservation and before/after behavior.

Fresh staging Security Advisor output no longer reports the mutable-search_path
warning. The leaked-password-protection warning remains; see
`auth-leaked-password-protection.md` for the verified Free-plan limitation. No
Auth setting was changed. Production still needs separate approval to apply this
one-line migration and verify its catalog/Advisor result in the reviewed release.
There is no frontend, Edge Function or secret dependency for this ALTER.

Final validation: all 145 local tests passed, including all 3 focused timestamp
tests. Production build passed with the existing bundle-size warning. Offline
release manifest validation passed with unchanged application/Edge/migration
hashes. No runtime source, historical migration or Auth setting was changed.
