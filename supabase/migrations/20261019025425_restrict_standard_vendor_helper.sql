-- Internal helper: only privileged internal/trigger callers may invoke it.
-- PUBLIC is a PostgreSQL pseudo-role; revoking only anon/authenticated would
-- leave their inherited PUBLIC EXECUTE permission in place.
-- The existing postgres-owned SECURITY DEFINER profile-insert trigger retains
-- owner execution. Keep the existing service_role grant and the separately
-- authorized restore_close_relax_standard_vendor() RPC unchanged.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.add_standard_close_relax_vendor(uuid)
  FROM PUBLIC, anon, authenticated;
COMMIT;
