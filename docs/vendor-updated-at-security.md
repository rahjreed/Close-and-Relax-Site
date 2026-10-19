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
