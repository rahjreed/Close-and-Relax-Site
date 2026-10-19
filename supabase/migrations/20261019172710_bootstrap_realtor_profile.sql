-- Owner-only, retryable profile creation. No auth.users trigger or eager backfill:
-- profile/vendor failures must not block signup, confirmation, login, or recovery.
BEGIN;

CREATE FUNCTION close_relax_private.bootstrap_own_profile()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
SET lock_timeout = '5s'
AS $function$
DECLARE
  owner_id uuid := auth.uid();
  auth_email text;
  metadata jsonb;
  own_profile public.profiles;
BEGIN
  IF owner_id IS NULL OR coalesce(auth.jwt()->>'role','') <> 'authenticated' THEN
    RAISE EXCEPTION 'Sign in to set up your profile.' USING ERRCODE='42501';
  END IF;
  -- The verified JWT selects the owner; there is no caller-supplied target ID.
  -- Hold a key-share lock so Auth deletion cannot race this transaction.
  SELECT u.email,u.raw_user_meta_data INTO auth_email,metadata
    FROM auth.users u WHERE u.id=owner_id AND u.deleted_at IS NULL
      AND coalesce(u.is_anonymous,false)=false AND u.email IS NOT NULL
      AND u.email_confirmed_at IS NOT NULL
    FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'A confirmed Realtor account is required.' USING ERRCODE='42501';
  END IF;

  SELECT * INTO own_profile FROM public.profiles p WHERE p.id=owner_id;
  IF FOUND THEN RETURN to_jsonb(own_profile); END IF;

  -- Only optional basic identity text is read from editable signup metadata.
  -- Never copy a plan, publication flag, slug, paid branding, or admin claims.
  INSERT INTO public.profiles(id,email,full_name,brokerage,city,plan,is_published,homeowner_savings_visible)
  VALUES(owner_id,auth_email,
    CASE WHEN jsonb_typeof(metadata->'full_name')='string' THEN left(btrim(metadata->>'full_name'),160) ELSE '' END,
    CASE WHEN jsonb_typeof(metadata->'brokerage')='string' THEN left(btrim(metadata->>'brokerage'),200) ELSE '' END,
    CASE WHEN jsonb_typeof(metadata->'market_city')='string' THEN left(btrim(metadata->>'market_city'),160) ELSE '' END,
    'partner',false,true)
  ON CONFLICT (id) DO NOTHING;
  -- A concurrent winner may have created the row; never upsert over saved data.
  SELECT * INTO own_profile FROM public.profiles p WHERE p.id=owner_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile setup could not finish. Please retry.'; END IF;
  RETURN to_jsonb(own_profile);
END;
$function$;

CREATE FUNCTION public.bootstrap_own_profile()
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $function$ SELECT close_relax_private.bootstrap_own_profile(); $function$;
REVOKE ALL ON FUNCTION close_relax_private.bootstrap_own_profile(),public.bootstrap_own_profile()
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION close_relax_private.bootstrap_own_profile(),public.bootstrap_own_profile() TO authenticated;

-- The existing owner INSERT policy remains, but browser insertion is retired.
-- Revoke explicit column INSERT grants too, if any exist in this installation.
REVOKE INSERT ON public.profiles FROM PUBLIC,anon,authenticated;
DO $block$
DECLARE columns text;
BEGIN
  SELECT string_agg(quote_ident(attname),',') INTO columns FROM pg_attribute
    WHERE attrelid='public.profiles'::regclass AND attnum>0 AND NOT attisdropped;
  EXECUTE format('REVOKE INSERT (%s) ON public.profiles FROM PUBLIC,anon,authenticated',columns);
END;
$block$;

-- Existing plan/branding, publication, and standard-vendor triggers run normally.
-- Existing rows, policies, UPDATE/SELECT permissions and deletion semantics stay.
COMMIT;
