-- READ ONLY. Run after the ten migrations, before any optional scheduler setup.
-- Catalog checks do not replace approved staging/browser/two-session tests.
SELECT jsonb_build_object(
  'helper_not_browser_callable',NOT has_function_privilege('anon','public.add_standard_close_relax_vendor(uuid)','EXECUTE') AND NOT has_function_privilege('authenticated','public.add_standard_close_relax_vendor(uuid)','EXECUTE'),
  'raw_profile_public_policy_removed',NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Public can view published profiles'),
  'raw_vendor_public_policy_removed',NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendors' AND policyname='Public can view vendors for published profiles'),
  'public_projection_present',to_regprocedure('public.get_public_realtor_profile(text)') IS NOT NULL,
  'vendor_projection_present',to_regprocedure('public.get_hub_vendors(uuid)') IS NOT NULL,
  'profile_insert_not_browser_granted',NOT has_table_privilege('authenticated','public.profiles','INSERT') AND NOT EXISTS(SELECT 1 FROM information_schema.column_privileges WHERE table_schema='public' AND table_name='profiles' AND grantee IN ('PUBLIC','anon','authenticated') AND privilege_type='INSERT'),
  'legacy_no_browser_grants',NOT has_table_privilege('anon','public.realtor_profiles','SELECT') AND NOT has_table_privilege('authenticated','public.realtor_profiles','SELECT') AND NOT has_table_privilege('authenticated','public.realtor_profiles','INSERT'),
  'slug_constraint_present',EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.profiles'::regclass AND conname='profiles_slug_canonical_check'),
  'vendor_timestamp_search_path_fixed',(SELECT proconfig @> ARRAY['search_path=""'] FROM pg_proc WHERE oid='public.set_vendor_updated_at()'::regprocedure),
  'analytics_no_direct_insert',NOT has_table_privilege('anon','public.hub_activity_events','INSERT') AND NOT has_table_privilege('authenticated','public.hub_activity_events','INSERT'),
  'analytics_rpc_callable',has_function_privilege('anon','public.record_hub_activity(jsonb)','EXECUTE'),
  'support_private',NOT has_table_privilege('anon','close_relax_private.support_messages','SELECT') AND NOT has_table_privilege('authenticated','close_relax_private.support_messages','SELECT'),
  'notification_private',NOT has_table_privilege('anon','close_relax_private.realtor_signup_notifications','SELECT') AND NOT has_table_privilege('authenticated','close_relax_private.realtor_signup_notifications','SELECT'),
  'new_private_rls',(SELECT bool_and(relrowsecurity) FROM pg_class WHERE oid IN ('close_relax_private.support_messages'::regclass,'close_relax_private.realtor_signup_notifications'::regclass)),
  'new_service_rpcs_restricted',NOT has_function_privilege('anon','public.submit_support_message(jsonb,text)','EXECUTE') AND NOT has_function_privilege('authenticated','public.submit_support_message(jsonb,text)','EXECUTE') AND NOT has_function_privilege('anon','public.claim_realtor_signup_notifications(text,text)','EXECUTE') AND NOT has_function_privilege('authenticated','public.claim_realtor_signup_notifications(text,text)','EXECUTE'),
  'emergency_tables_retained',to_regclass('public.emergency_service_assignments') IS NOT NULL AND (SELECT count(*)=6 FROM public.emergency_service_categories),
  'emergency_public_policy_preserved',EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='emergency_service_assignments' AND policyname='Public can read published emergency assignments'),
  'limits_match_saved_plans',(SELECT coalesce(bool_and(public.vendor_plan_limit(id)=CASE WHEN lower(coalesce(plan,'partner'))='premier' THEN 30 WHEN lower(coalesce(plan,'partner')) IN ('pro','core') THEN 15 ELSE 5 END),true) FROM public.profiles),
  'insurance_still_service_only',NOT has_function_privilege('anon','public.submit_goosehead_homeowner_lead(jsonb,text)','EXECUTE') AND NOT has_function_privilege('authenticated','public.submit_goosehead_homeowner_lead(jsonb,text)','EXECUTE') AND has_function_privilege('service_role','public.submit_goosehead_homeowner_lead(jsonb,text)','EXECUTE'),
  'scheduler_extensions_still_absent',NOT EXISTS(SELECT 1 FROM pg_extension WHERE extname IN ('pg_cron','pg_net'))
) AS release_gate;
