-- Preserve the existing body, invoker security, owner, ACL and trigger identity.
-- now() resolves through PostgreSQL's implicit trusted pg_catalog search.
ALTER FUNCTION public.set_vendor_updated_at() SET search_path = '';
