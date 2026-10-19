-- STAGING ONLY: rollback-only account/profile acceptance. No production use.
-- Requires staging_control.environment_guard and existing synthetic fixtures.
-- No Auth email, login session, external request, or persisted test trigger.
BEGIN;
DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM staging_control.environment_guard WHERE project_ref='amopxaadnvubvveqpkvu') THEN RAISE EXCEPTION 'Staging only'; END IF; END $guard$;
CREATE TEMP TABLE bootstrap_acceptance_results(check_name text,passed boolean);
DO $test$
DECLARE test_id uuid := gen_random_uuid(); legacy_id uuid := gen_random_uuid(); saved record; result jsonb; before_row jsonb; attempt integer; denied boolean;
BEGIN
 -- Existing fixtures remain unchanged after this transaction is rolled back.
 UPDATE auth.users SET email_confirmed_at=now() WHERE id IN (SELECT user_id FROM staging_control.fixture_identities WHERE fixture IN ('free','core','pro','draft'));
 FOR saved IN SELECT p.id,to_jsonb(p) AS original FROM public.profiles p JOIN staging_control.fixture_identities f ON f.user_id=p.id WHERE f.fixture IN ('free','core','pro','draft') LOOP
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',saved.id,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  result := public.bootstrap_own_profile();
  RESET ROLE;
  IF result IS DISTINCT FROM saved.original THEN RAISE EXCEPTION 'Existing profile altered'; END IF;
 END LOOP;
 INSERT INTO bootstrap_acceptance_results VALUES('existing Free/Core/Pro/draft returned unchanged',true);
 INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data,banned_until)
 VALUES(test_id,'staging-bootstrap-new@example.invalid',now(),'{"plan":"premier","admin":true,"is_published":true,"slug":"admin","full_name":"Synthetic new signup","photo_url":"paid","homeowner_savings_visible":false}','infinity'),
 (legacy_id,'staging-bootstrap-legacy@example.invalid',now()-interval '30 days','{"plan":"pro","full_name":"Synthetic legacy recovery"}','infinity');
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',test_id,'role','authenticated')::text,true);
 SET LOCAL ROLE authenticated;
 result := public.bootstrap_own_profile();
 RESET ROLE;
 IF result->>'plan'<>'partner' OR (result->>'is_published')::boolean OR result->>'slug' IS NOT NULL OR NOT (result->>'homeowner_savings_visible')::boolean OR result->>'photo_url' IS NOT NULL THEN RAISE EXCEPTION 'Metadata injection'; END IF;
 IF EXISTS(SELECT 1 FROM close_relax_private.platform_admins WHERE user_id=test_id) THEN RAISE EXCEPTION 'Admin injection'; END IF;
 INSERT INTO bootstrap_acceptance_results VALUES('confirmed signup creates Free draft; metadata plan/admin/branding ignored',true);
 FOR attempt IN 1..4 LOOP
  SET LOCAL ROLE authenticated; result:=public.bootstrap_own_profile(); RESET ROLE;
 END LOOP;
 IF (SELECT count(*) FROM public.profiles WHERE id=test_id)<>1 OR (SELECT count(*) FROM public.vendors WHERE profile_id=test_id AND is_default)<>1 THEN RAISE EXCEPTION 'Duplicate profile/vendor'; END IF;
 INSERT INTO bootstrap_acceptance_results VALUES('repeated bootstrap creates exactly one profile and standard vendor',true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',legacy_id,'role','authenticated')::text,true);
 SET LOCAL ROLE authenticated; result:=public.bootstrap_own_profile(); RESET ROLE;
 IF result->>'id'<>legacy_id::text OR result->>'plan'<>'partner' THEN RAISE EXCEPTION 'Legacy recovery failed'; END IF;
 INSERT INTO bootstrap_acceptance_results VALUES('older confirmed Auth user missing profile recovers',true);
 denied:=false;
 BEGIN
  SET LOCAL ROLE authenticated;
  INSERT INTO public.profiles(id,plan) VALUES(gen_random_uuid(),'premier');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 RESET ROLE;
 IF NOT denied THEN RAISE EXCEPTION 'Browser INSERT permitted'; END IF;
 INSERT INTO bootstrap_acceptance_results VALUES('direct browser profile INSERT denied',true);
 denied:=false;
 BEGIN SET LOCAL ROLE authenticated; UPDATE public.profiles SET plan='premier' WHERE id=legacy_id;
 EXCEPTION WHEN raise_exception THEN denied:=true; END;
 RESET ROLE;
 IF NOT denied THEN RAISE EXCEPTION 'Browser plan change permitted'; END IF;
 INSERT INTO bootstrap_acceptance_results VALUES('existing plan protection rejects browser upgrade',true);
END $test$;
-- A temporary, transaction-scoped test trigger simulates dependency failure.
CREATE FUNCTION pg_temp.reject_test_vendor() RETURNS trigger LANGUAGE plpgsql AS $fail$
BEGIN IF current_setting('close_relax.fail_vendor',true)='yes' THEN RAISE EXCEPTION 'Synthetic vendor dependency failure'; END IF; RETURN NEW; END $fail$;
CREATE TRIGGER staging_bootstrap_failure_test BEFORE INSERT ON public.vendors FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_test_vendor();
DO $retry$
DECLARE failed_id uuid:=gen_random_uuid(); failed boolean:=false; result jsonb;
BEGIN
 INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data,banned_until) VALUES(failed_id,'staging-bootstrap-failure@example.invalid',now(),'{}','infinity');
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',failed_id,'role','authenticated')::text,true);
 PERFORM set_config('close_relax.fail_vendor','yes',true);
 BEGIN SET LOCAL ROLE authenticated; result:=public.bootstrap_own_profile();
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'Synthetic vendor dependency failure' THEN RAISE; END IF;
  failed:=true;
 END;
 RESET ROLE;
 IF NOT failed OR EXISTS(SELECT 1 FROM public.profiles WHERE id=failed_id) OR EXISTS(SELECT 1 FROM public.vendors WHERE profile_id=failed_id) THEN RAISE EXCEPTION 'Failure was not atomic'; END IF;
 PERFORM set_config('close_relax.fail_vendor','no',true);
 SET LOCAL ROLE authenticated; result:=public.bootstrap_own_profile(); result:=public.bootstrap_own_profile(); RESET ROLE;
 IF result->>'plan'<>'partner' OR (SELECT count(*) FROM public.profiles WHERE id=failed_id)<>1 OR (SELECT count(*) FROM public.vendors WHERE profile_id=failed_id AND is_default)<>1 THEN RAISE EXCEPTION 'Retry failed'; END IF;
 INSERT INTO bootstrap_acceptance_results VALUES('failed vendor dependency rolls back profile; retry succeeds exactly once',true);
END $retry$;
SELECT jsonb_agg(to_jsonb(r)) AS results FROM bootstrap_acceptance_results r;
ROLLBACK;
