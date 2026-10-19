-- READ ONLY. Initial baseline gate; verify project hphcejnvxyccmwmofdqc in the connector/dashboard first.
-- Stop on any false result or unexpected migration history. Never repair history automatically.
SELECT jsonb_build_object(
  'historical_mapping', (SELECT jsonb_agg(jsonb_build_object('version',version,'name',name) ORDER BY version)
    FROM supabase_migrations.schema_migrations),
  'emergency_tables_retained',to_regclass('public.emergency_service_categories') IS NOT NULL AND to_regclass('public.emergency_service_assignments') IS NOT NULL,
  'emergency_categories_six',(SELECT count(*)=6 FROM public.emergency_service_categories),
  'legacy_rows_zero',(SELECT count(*)=0 FROM public.realtor_profiles),
  'slug_preflight_passes',NOT EXISTS(SELECT 1 FROM public.profiles WHERE
    (slug IS NULL AND is_published IS TRUE) OR (slug IS NOT NULL AND (
      length(slug) NOT BETWEEN 1 AND 63 OR slug COLLATE "C" !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'
      OR slug IN ('www','app','admin','api','auth','login','logout','signup','dashboard','support','billing','insurance','mail','smtp','ftp','static','assets','cdn','status','account','accounts','settings','contact','help','pricing','plans','benefits','privacy','terms','reset-password','forgot-password','verify','oauth','callback','webmail','autodiscover','imap','pop','pop3','mx','dns','ns1','ns2','dev','test','staging','preview','localhost','closeandrelax')))),
  'limits_match_saved_plans',(SELECT coalesce(bool_and(public.vendor_plan_limit(id)=CASE WHEN lower(coalesce(plan,'partner'))='premier' THEN 30 WHEN lower(coalesce(plan,'partner')) IN ('pro','core') THEN 15 ELSE 5 END),true) FROM public.profiles),
  'profile_public_policy_present',EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Public can view published profiles'),
  'vendor_public_policy_present',EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendors' AND policyname='Public can view vendors for published profiles'),
  'analytics_direct_policy_present',EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='hub_activity_events' AND policyname='Public can record published hub activity'),
  'insurance_private_rls',(SELECT relrowsecurity FROM pg_class WHERE oid='close_relax_private.goosehead_homeowner_leads'::regclass),
  'insurance_service_only',NOT has_function_privilege('anon','public.submit_goosehead_homeowner_lead(jsonb,text)','EXECUTE') AND NOT has_function_privilege('authenticated','public.submit_goosehead_homeowner_lead(jsonb,text)','EXECUTE') AND has_function_privilege('service_role','public.submit_goosehead_homeowner_lead(jsonb,text)','EXECUTE'),
  'private_admin_count',(SELECT count(*) FROM close_relax_private.platform_admins),
  'scheduler_extensions_absent',NOT EXISTS(SELECT 1 FROM pg_extension WHERE extname IN ('pg_cron','pg_net'))
) AS baseline_gate;
