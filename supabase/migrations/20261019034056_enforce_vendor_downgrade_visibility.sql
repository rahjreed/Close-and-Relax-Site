-- Depends on the owner-only raw profile boundary in enforce_profile_branding.
-- No vendor rows are deleted, deactivated, reordered or overwritten.
BEGIN;

CREATE FUNCTION public.get_hub_vendors(hub_profile_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $function$
DECLARE saved_plan text; allowed_count integer; result jsonb;
BEGIN
  -- Authenticated private preview may select only its own draft. All other
  -- callers, including signed-in Realtors, require a published target profile.
  SELECT lower(coalesce(p.plan,'partner')) INTO saved_plan FROM public.profiles p
    WHERE p.id=hub_profile_id AND (p.is_published=true OR p.id=auth.uid());
  IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;
  allowed_count := public.vendor_plan_limit(hub_profile_id);
  WITH ranked AS (
    SELECT v.*, row_number() OVER(PARTITION BY v.is_default
      ORDER BY v.sort_order ASC NULLS LAST,v.created_at ASC NULLS LAST,v.id ASC) AS position
    FROM public.vendors v WHERE v.profile_id=hub_profile_id AND v.is_active=true
  ), visible AS (
    SELECT (to_jsonb(v)-'position') || jsonb_build_object('recommendation',
      CASE WHEN saved_plan IN ('pro','core','premier') THEN v.recommendation ELSE NULL END) AS record,
      CASE WHEN saved_plan='premier' THEN 0 ELSE 1 END AS group_order,
      v.sort_order,v.created_at,v.id::text AS sort_id
    FROM ranked v WHERE v.is_default=false AND v.position<=allowed_count
    UNION ALL
    SELECT to_jsonb(v)-'position',0,v.sort_order,v.created_at,v.id::text
    FROM ranked v WHERE saved_plan='premier' AND v.is_default=true AND v.position=1
    UNION ALL
    -- Mandatory Free/Core platform resource is a projection, not a saved vendor.
    -- Use the same verified platform contact as add_standard_close_relax_vendor.
    -- A Pro owner's removed/inactive/edited standard record is never overwritten.
    SELECT jsonb_build_object('id','platform-standard-'||hub_profile_id::text,
      'profile_id',hub_profile_id,'name','Roger With Vivint','category','Smart Home & Security',
      'phone','463-281-3454','website','https://rogerwithvivint.com','recommendation',NULL,
      'sort_order',0,'is_active',true,'is_default',true,
      'created_at','1970-01-01T00:00:00+00:00','updated_at','1970-01-01T00:00:00+00:00'),
      0,0,'1970-01-01'::timestamptz,'platform-standard-'||hub_profile_id::text
    WHERE saved_plan<>'premier'
  ) SELECT coalesce(jsonb_agg(record ORDER BY group_order,sort_order ASC NULLS LAST,
      created_at ASC NULLS LAST,sort_id),'[]'::jsonb) INTO result FROM visible;
  RETURN result;
END;
$function$;
REVOKE ALL ON FUNCTION public.get_hub_vendors(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_hub_vendors(uuid) TO anon,authenticated,service_role;

-- Raw vendor records, including overflow and retained paid notes, are owner-only.
-- No public SELECT * route can bypass the cap by changing filters or pagination.
DROP POLICY "Public can view vendors for published profiles" ON public.vendors;

CREATE OR REPLACE FUNCTION public.enforce_vendor_plan_rules()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
DECLARE target_id uuid; custom_vendor_count integer; allowed_vendor_count integer;
BEGIN
  IF TG_OP='DELETE' THEN target_id:=OLD.profile_id; ELSE target_id:=NEW.profile_id; END IF;
  IF TG_OP='UPDATE' THEN
    IF NEW.profile_id IS DISTINCT FROM OLD.profile_id THEN RAISE EXCEPTION 'A vendor cannot be moved to another profile.'; END IF;
    IF NEW.is_default IS DISTINCT FROM OLD.is_default THEN RAISE EXCEPTION 'The default vendor designation cannot be changed.'; END IF;
  END IF;
  -- Serialize vendor mutations against one another and billing plan changes.
  -- Count only after taking this lock; inactive/overflow records still count as
  -- saved slots for new insertions, preserving the existing storage-limit rule.
  PERFORM 1 FROM public.profiles p WHERE p.id=target_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unable to determine vendor limit for this profile.'; END IF;
  IF TG_OP='INSERT' AND NEW.is_default=false THEN
    allowed_vendor_count:=public.vendor_plan_limit(target_id);
    SELECT count(*) INTO custom_vendor_count FROM public.vendors v WHERE v.profile_id=target_id AND v.is_default=false;
    IF custom_vendor_count>=allowed_vendor_count THEN
      RAISE EXCEPTION 'Your current plan allows up to % custom vendors.',allowed_vendor_count;
    END IF;
    IF coalesce(btrim(NEW.recommendation),'')<>'' AND NOT coalesce(public.vendor_plan_allows_recommendations(target_id),false) THEN
      RAISE EXCEPTION 'Vendor recommendation notes require Core or Pro.';
    END IF;
  ELSIF TG_OP IN ('UPDATE','DELETE') THEN
    IF OLD.is_default=true AND NOT coalesce(public.vendor_plan_allows_default_control(target_id),false) THEN
      RAISE EXCEPTION 'The standard Close & Relax vendor can only be edited or removed on Pro.';
    END IF;
    IF TG_OP='UPDATE' AND OLD.is_default=false
      AND NOT coalesce(public.vendor_plan_allows_recommendations(target_id),false)
      AND nullif(btrim(NEW.recommendation),'') IS DISTINCT FROM nullif(btrim(OLD.recommendation),'') THEN
      RAISE EXCEPTION 'Vendor recommendation notes require Core or Pro.';
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;
COMMIT;
