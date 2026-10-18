-- OPTIONAL CLEANUP ONLY: apply after My Home Contacts is deployed and old clients
-- are retired. Export/review existing assignments before separately approving
-- their removal. This migration refuses to discard any saved assignments.
BEGIN;
LOCK TABLE public.emergency_service_assignments IN ACCESS EXCLUSIVE MODE;
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM public.emergency_service_assignments) THEN
    RAISE EXCEPTION 'Emergency assignments still exist. Export/review them and separately approve their removal before this cleanup.';
  END IF;
END;
$guard$;

-- RESTRICT is intentional: unexpected external dependencies must stop cleanup.
-- Dropping the tables removes only their own policies, grants and trigger.
DROP TABLE public.emergency_service_assignments RESTRICT;
DROP TABLE public.emergency_service_categories RESTRICT;
DROP FUNCTION public.validate_emergency_service_assignment() RESTRICT;
COMMIT;
