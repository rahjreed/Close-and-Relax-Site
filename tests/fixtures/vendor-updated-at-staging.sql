-- STAGING ONLY: rollback-only timestamp trigger acceptance; not an installer.
BEGIN;
DO $guard$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM staging_control.environment_guard WHERE project_ref='amopxaadnvubvveqpkvu')
 OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.set_vendor_updated_at()'::regprocedure AND proconfig @> ARRAY['search_path=""'])
 THEN RAISE EXCEPTION 'Isolated staging with hardened function required'; END IF;
END $guard$;
CREATE FUNCTION public.now() RETURNS timestamptz LANGUAGE sql AS $$SELECT '1900-01-01'::timestamptz$$;
SET LOCAL search_path=public,pg_catalog;
CREATE TEMP TABLE timestamp_acceptance_results(check_name text,passed boolean);
DO $test$
DECLARE owner_id uuid; saved_id uuid; created_time timestamptz; updated_time timestamptz; touched integer; denied boolean:=false;
BEGIN
 SELECT user_id INTO owner_id FROM staging_control.fixture_identities WHERE fixture='core';
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
 SET LOCAL ROLE authenticated;
 INSERT INTO public.vendors(profile_id,name,category,phone,created_at,updated_at)
 VALUES(owner_id,'Synthetic timestamp acceptance','Staging Service','202-555-0110','2000-01-01','2001-01-01')
 RETURNING id,created_at,updated_at INTO saved_id,created_time,updated_time;
 RESET ROLE;
 IF created_time<>'2000-01-01'::timestamptz OR updated_time<>'2001-01-01'::timestamptz THEN RAISE EXCEPTION 'INSERT timestamp behavior changed'; END IF;
 INSERT INTO timestamp_acceptance_results VALUES('INSERT preserves explicit timestamps and does not invoke UPDATE trigger',true);
 SET LOCAL ROLE authenticated;
 UPDATE public.vendors SET name='Synthetic edited vendor',updated_at='1900-01-01' WHERE id=saved_id
 RETURNING created_at,updated_at INTO created_time,updated_time;
 RESET ROLE;
 IF created_time<>'2000-01-01'::timestamptz OR updated_time IS DISTINCT FROM pg_catalog.now() THEN RAISE EXCEPTION 'Normal edit timestamp mismatch'; END IF;
 SET LOCAL ROLE authenticated;
 UPDATE public.vendors SET updated_at=null WHERE id=saved_id RETURNING updated_at INTO updated_time;
 RESET ROLE;
 IF updated_time IS DISTINCT FROM pg_catalog.now() THEN RAISE EXCEPTION 'NULL timestamp bypass'; END IF;
 INSERT INTO timestamp_acceptance_results VALUES('edits override supplied timestamps using trusted pg_catalog.now despite caller shadowing',true);
 SET LOCAL ROLE authenticated;
 UPDATE public.vendors SET name=name WHERE profile_id=owner_id AND NOT is_default;
 GET DIAGNOSTICS touched=ROW_COUNT;
 RESET ROLE;
 IF touched=0 OR EXISTS(SELECT 1 FROM public.vendors WHERE profile_id=owner_id AND NOT is_default AND updated_at IS DISTINCT FROM pg_catalog.now()) THEN RAISE EXCEPTION 'No-op/multi-row update mismatch'; END IF;
 INSERT INTO timestamp_acceptance_results VALUES('no-op and multi-row UPDATE timestamps remain correct',true);
 BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM public.set_vendor_updated_at();
 EXCEPTION WHEN others THEN
  IF SQLERRM NOT LIKE 'trigger functions can only be called as triggers%' THEN RAISE; END IF;
  denied:=true;
 END;
 RESET ROLE;
 IF NOT denied THEN RAISE EXCEPTION 'Direct trigger function call unexpectedly succeeded'; END IF;
 INSERT INTO timestamp_acceptance_results VALUES('function remains trigger-only without new privileges',true);
END $test$;
SELECT jsonb_agg(to_jsonb(r)) AS results FROM timestamp_acceptance_results r;
ROLLBACK;

