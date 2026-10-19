-- STAGING ONLY: rollback-only slug acceptance. Not a migration or installer.
BEGIN;
DO $guard$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM staging_control.environment_guard WHERE project_ref='amopxaadnvubvveqpkvu')
 OR to_regprocedure('public.is_valid_realtor_slug(text)') IS NULL
 THEN RAISE EXCEPTION 'Staging slug migration required'; END IF;
END $guard$;
CREATE TEMP TABLE slug_acceptance_results(check_name text,passed boolean);
DO $validation$
DECLARE candidate text; owner_id uuid; other_id uuid; rejected boolean; changed integer; saved_slug text;
BEGIN
 SELECT user_id INTO owner_id FROM staging_control.fixture_identities WHERE fixture='free';
 SELECT user_id INTO other_id FROM staging_control.fixture_identities WHERE fixture='core';
 SELECT slug INTO saved_slug FROM public.profiles WHERE id=owner_id;
 FOREACH candidate IN ARRAY ARRAY['a','12','rahjreed','jane-doe','a--b','1-realty-2',repeat('a',63)] LOOP
  IF NOT public.is_valid_realtor_slug(candidate) THEN RAISE EXCEPTION 'Valid label rejected: %',candidate; END IF;
 END LOOP;
 FOREACH candidate IN ARRAY ARRAY[null::text,'',' ','Jane',' jane ','jane_doe','jane.doe','jane/doe','-jane','jane-','josé',E'jane\n',repeat('a',64),'www','app','admin','api','auth','login','logout','signup','dashboard','support','billing','insurance','mail','smtp','ftp','static','assets','cdn','status','account','accounts','settings','contact','help','pricing','plans','benefits','privacy','terms','reset-password','forgot-password','verify','oauth','callback','webmail','autodiscover','imap','pop','pop3','mx','dns','ns1','ns2','dev','test','staging','preview','localhost','closeandrelax'] LOOP
  IF public.is_valid_realtor_slug(candidate) THEN RAISE EXCEPTION 'Invalid label accepted: %',candidate; END IF;
  IF candidate IS NULL THEN CONTINUE; END IF;
  rejected:=false;
  BEGIN
   PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
   SET LOCAL ROLE authenticated;
   UPDATE public.profiles SET slug=candidate WHERE id=owner_id;
  EXCEPTION WHEN check_violation THEN rejected:=true; END;
  RESET ROLE;
  IF NOT rejected THEN RAISE EXCEPTION 'Direct owner UPDATE bypass: %',candidate; END IF;
  rejected:=false;
  BEGIN INSERT INTO public.profiles(id,slug) VALUES(gen_random_uuid(),candidate);
  EXCEPTION WHEN check_violation THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Privileged INSERT bypass: %',candidate; END IF;
 END LOOP;
 INSERT INTO slug_acceptance_results VALUES('valid formats accepted; invalid/uppercase/reserved labels rejected by validator and direct writes',true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
 rejected:=false;
 BEGIN
  SET LOCAL ROLE authenticated;
  UPDATE public.profiles SET slug=(SELECT slug FROM public.profiles WHERE id=other_id) WHERE id=owner_id;
 EXCEPTION WHEN unique_violation THEN rejected:=true; END;
 RESET ROLE;
 IF NOT rejected THEN RAISE EXCEPTION 'Duplicate slug accepted'; END IF;
 INSERT INTO slug_acceptance_results VALUES('unique slug constraint remains authoritative',true);
 rejected:=false;
 BEGIN SET LOCAL ROLE authenticated; INSERT INTO public.profiles(id,slug) VALUES(owner_id,'injected-profile');
 EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
 RESET ROLE;
 IF NOT rejected THEN RAISE EXCEPTION 'Browser INSERT unexpectedly allowed'; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',other_id,'role','authenticated')::text,true);
 SET LOCAL ROLE authenticated;
 UPDATE public.profiles SET slug='cross-owner-injection' WHERE id=owner_id;
 GET DIAGNOSTICS changed=ROW_COUNT;
 RESET ROLE;
 IF changed<>0 OR (SELECT slug FROM public.profiles WHERE id=owner_id) IS DISTINCT FROM saved_slug THEN RAISE EXCEPTION 'Foreign owner changed slug'; END IF;
 INSERT INTO slug_acceptance_results VALUES('browser INSERT and foreign-owner mutation denied',true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
 SET LOCAL ROLE authenticated;
 UPDATE public.profiles SET slug='synthetic-updated-hub' WHERE id=owner_id;
 RESET ROLE;
 SET LOCAL ROLE anon;
 IF EXISTS(SELECT 1 FROM public.profiles WHERE slug=saved_slug)
 OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE slug='synthetic-updated-hub' AND id=owner_id) THEN RAISE EXCEPTION 'Published lookup mismatch'; END IF;
 RESET ROLE;
 INSERT INTO slug_acceptance_results VALUES('owner slug edit switches published lookup without redirecting old slug',true);
END $validation$;
DO $draft$
DECLARE draft_id uuid; new_id uuid:=gen_random_uuid(); result jsonb; rejected boolean;
BEGIN
 SELECT user_id INTO draft_id FROM staging_control.fixture_identities WHERE fixture='draft';
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',draft_id,'role','authenticated')::text,true);
 SET LOCAL ROLE authenticated;
 UPDATE public.profiles SET slug='synthetic-draft-hub' WHERE id=draft_id;
 RESET ROLE;
 SET LOCAL ROLE anon;
 IF EXISTS(SELECT 1 FROM public.profiles WHERE slug='synthetic-draft-hub') THEN RAISE EXCEPTION 'Draft publicly readable'; END IF;
 RESET ROLE;
 INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data,banned_until)
 VALUES(new_id,'synthetic-slug-bootstrap@example.invalid',now(),'{"slug":"admin","plan":"premier"}','infinity');
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',new_id,'role','authenticated')::text,true);
 SET LOCAL ROLE authenticated;
 result:=public.bootstrap_own_profile();
 RESET ROLE;
 IF result->>'slug' IS NOT NULL OR (result->>'is_published')::boolean OR result->>'plan'<>'partner' THEN RAISE EXCEPTION 'Draft bootstrap mismatch'; END IF;
 rejected:=false;
 BEGIN SET LOCAL ROLE authenticated; UPDATE public.profiles SET is_published=true WHERE id=new_id;
 EXCEPTION WHEN check_violation THEN rejected:=true; END;
 RESET ROLE;
 IF NOT rejected THEN RAISE EXCEPTION 'NULL slug publication allowed'; END IF;
 SET LOCAL ROLE authenticated;
 UPDATE public.profiles SET slug='synthetic-new-realtor',is_published=true WHERE id=new_id;
 RESET ROLE;
 rejected:=false;
 BEGIN SET LOCAL ROLE authenticated; UPDATE public.profiles SET slug=null,is_published=false WHERE id=new_id;
 EXCEPTION WHEN check_violation THEN rejected:=true; END;
 RESET ROLE;
 IF NOT rejected THEN RAISE EXCEPTION 'Assigned slug cleared'; END IF;
 INSERT INTO slug_acceptance_results VALUES('unpublished isolation, NULL bootstrap, publication prerequisite and no-clearing rule preserved',true);
END $draft$;
SELECT jsonb_agg(to_jsonb(r)) AS results FROM slug_acceptance_results r;
ROLLBACK;

