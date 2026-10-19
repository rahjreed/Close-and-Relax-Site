-- Retain this unused legacy table and its history; retire its Data API access.
-- The active application uses public.profiles. No data is deleted or migrated.
BEGIN;

ALTER TABLE public.realtor_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view realtor profiles" ON public.realtor_profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON public.realtor_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.realtor_profiles;

REVOKE ALL PRIVILEGES ON TABLE public.realtor_profiles
  FROM PUBLIC, anon, authenticated, service_role;
-- Table revocation alone does not remove independently granted column rights.
DO $block$
DECLARE legacy_columns text;
BEGIN
  SELECT string_agg(quote_ident(attname), ',') INTO legacy_columns
    FROM pg_attribute WHERE attrelid = 'public.realtor_profiles'::regclass
      AND attnum > 0 AND NOT attisdropped;
  EXECUTE format(
    'REVOKE ALL PRIVILEGES (%s) ON TABLE public.realtor_profiles FROM PUBLIC, anon, authenticated, service_role',
    legacy_columns);
END;
$block$;

COMMENT ON TABLE public.realtor_profiles IS
  'Deprecated legacy table: retained for history, no API-role access. Active Realtor accounts use public.profiles. Any later removal requires a fresh dependency/data audit and separate approval.';
COMMIT;
