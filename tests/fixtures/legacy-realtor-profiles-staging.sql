-- STAGING ONLY: rollback-only legacy-lockdown acceptance.
-- Never copy to supabase/migrations or run on production.
BEGIN;
DO $guard$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM staging_control.environment_guard WHERE project_ref='amopxaadnvubvveqpkvu')
 THEN RAISE EXCEPTION 'Staging-only guard failed'; END IF;
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='realtor_profiles')
 OR has_table_privilege('anon','public.realtor_profiles','SELECT')
 THEN RAISE EXCEPTION 'Lockdown is not applied; this is not an installer'; END IF;
END $guard$;
CREATE TEMP TABLE legacy_lockdown_results(check_name text,passed boolean);
DO $test$
DECLARE owner_id uuid; other_id uuid; saved jsonb; role_name text; statement text; forbidden boolean;
BEGIN
 SELECT user_id INTO owner_id FROM staging_control.fixture_identities WHERE fixture='free';
 SELECT user_id INTO other_id FROM staging_control.fixture_identities WHERE fixture='core';
 INSERT INTO public.realtor_profiles(user_id,slug,full_name,email,plan)
 VALUES(owner_id,'synthetic-legacy-test','Synthetic retained legacy identity','synthetic-legacy@example.invalid','premier')
 RETURNING to_jsonb(realtor_profiles.*) INTO saved;
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role',role_name)::text,true);
  FOREACH statement IN ARRAY ARRAY[
   'SELECT * FROM public.realtor_profiles',
   'SELECT email FROM public.realtor_profiles',
   format('INSERT INTO public.realtor_profiles(user_id,slug,plan) VALUES(%L,%L,%L)',other_id,'synthetic-injection','premier'),
   'UPDATE public.realtor_profiles SET plan=''partner'' WHERE slug=''synthetic-legacy-test'''
  ] LOOP
   forbidden:=false;
   BEGIN
    EXECUTE format('SET LOCAL ROLE %I',role_name);
    EXECUTE statement;
   EXCEPTION WHEN insufficient_privilege THEN forbidden:=true; END;
   RESET ROLE;
   IF NOT forbidden THEN RAISE EXCEPTION 'Legacy access remained for %: %',role_name,statement; END IF;
  END LOOP;
 END LOOP;
 IF (SELECT to_jsonb(p) FROM public.realtor_profiles p WHERE id=(saved->>'id')::uuid) IS DISTINCT FROM saved
 THEN RAISE EXCEPTION 'Retained row changed'; END IF;
 INSERT INTO legacy_lockdown_results VALUES('anon/authenticated/service_role SELECT and writes denied; seeded legacy row preserved',true);
END $test$;
DO $active$
DECLARE owner_id uuid; before_row jsonb; result jsonb;
BEGIN
 SELECT user_id INTO owner_id FROM staging_control.fixture_identities WHERE fixture='core';
 SELECT to_jsonb(p) INTO before_row FROM public.profiles p WHERE id=owner_id;
 UPDATE auth.users SET email_confirmed_at=now() WHERE id=owner_id;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
 SET LOCAL ROLE authenticated;
 result:=public.bootstrap_own_profile();
 RESET ROLE;
 IF result IS DISTINCT FROM before_row THEN RAISE EXCEPTION 'Active profile unexpectedly changed'; END IF;
 INSERT INTO legacy_lockdown_results VALUES('active Core profile bootstrap returns unchanged; legacy row is ignored',true);
END $active$;
SELECT jsonb_agg(to_jsonb(r)) AS results FROM legacy_lockdown_results r;
ROLLBACK;

