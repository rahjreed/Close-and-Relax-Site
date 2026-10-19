-- Retain existing paid values and legacy aliases; change authorization and the
-- public projection, not stored profile data. Deploy with the matching frontend:
-- old SELECT-* public loaders intentionally stop working after this migration.
BEGIN;

CREATE OR REPLACE FUNCTION public.protect_profile_plan()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $function$
DECLARE
  jwt_role text := coalesce(auth.jwt()->>'role','');
  effective_plan text;
  field_name text;
  locked_fields text[] := ARRAY[]::text[];
BEGIN
  IF TG_OP = 'INSERT' AND jwt_role = 'authenticated' THEN NEW.plan := 'partner'; END IF;
  IF TG_OP = 'UPDATE' AND jwt_role = 'authenticated' AND NEW.plan IS DISTINCT FROM OLD.plan THEN
    RAISE EXCEPTION 'Subscription plan changes must be handled by Close & Relax billing.';
  END IF;
  effective_plan := lower(coalesce(NEW.plan,'partner'));
  IF effective_plan NOT IN ('partner','free','pro','core','premier') THEN
    RAISE EXCEPTION 'Unknown Close & Relax plan value.';
  END IF;
  IF effective_plan IN ('partner','free') THEN
    locked_fields := ARRAY['headshot_url','photo_url','profile_image_url','image_url',
      'welcome_message','welcome','bio','website_url','website',
      'instagram_url','facebook_url','linkedin_url'];
  END IF;
  IF effective_plan <> 'premier' THEN
    locked_fields := locked_fields || ARRAY['welcome_video_url','video_url','app_icon_initials','app_initials'];
  END IF;
  FOREACH field_name IN ARRAY locked_fields LOOP
    -- JSON access also covers old aliases if a schema still contains them;
    -- absent columns are null. No new alias columns are introduced.
    IF TG_OP = 'INSERT' THEN
      IF coalesce(btrim(to_jsonb(NEW)->>field_name),'') <> '' THEN
        RAISE EXCEPTION 'This profile customization is not included with your current plan.';
      END IF;
    ELSIF (to_jsonb(NEW)->>field_name) IS DISTINCT FROM (to_jsonb(OLD)->>field_name)
      AND NOT (coalesce(btrim(to_jsonb(NEW)->>field_name),'') = ''
        AND coalesce(btrim(to_jsonb(OLD)->>field_name),'') = '') THEN
      -- Existing forms may round-trip an unset NULL as an empty string.
      -- Permit only that empty equivalence, never edits/removal of saved content.
      RAISE EXCEPTION 'This profile customization is not included with your current plan.';
    END IF;
  END LOOP;
  -- Billing downgrades may change only the plan and leave locked values intact.
  -- Those values are owner-only; the public RPC below excludes them by plan.
  RETURN NEW;
END;
$function$;

-- Policies on child records need a publication check without reading private
-- branding columns. This intentionally public boolean helper exposes no draft
-- contents, owner metadata or branding. It never writes or authorizes ownership.
CREATE FUNCTION public.is_published_hub(target_profile_id uuid, required_plan text DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $function$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=target_profile_id
    AND p.is_published=true
    AND (required_plan IS NULL OR (required_plan='premier' AND p.plan='premier')));
$function$;
REVOKE ALL ON FUNCTION public.is_published_hub(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_published_hub(uuid,text) TO anon,authenticated,service_role;

CREATE FUNCTION public.get_public_realtor_profile(hub_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $function$
  SELECT jsonb_build_object(
    'id',p.id,'slug',p.slug,'plan',p.plan,'is_published',p.is_published,
    'full_name',p.full_name,'email',p.email,'phone',p.phone,'brokerage',p.brokerage,
    'title',p.title,'city',p.city,'state',p.state,
    'homeowner_savings_visible',p.homeowner_savings_visible,
    'headshot_url',CASE WHEN lower(coalesce(p.plan,'partner')) IN ('pro','core','premier') THEN p.headshot_url END,
    'photo_url',CASE WHEN lower(coalesce(p.plan,'partner')) IN ('pro','core','premier') THEN p.photo_url END,
    'welcome_message',CASE WHEN lower(coalesce(p.plan,'partner')) IN ('pro','core','premier') THEN p.welcome_message END,
    'bio',CASE WHEN lower(coalesce(p.plan,'partner')) IN ('pro','core','premier') THEN p.bio END,
    'website_url',CASE WHEN lower(coalesce(p.plan,'partner')) IN ('pro','core','premier') THEN p.website_url END,
    'instagram_url',CASE WHEN lower(coalesce(p.plan,'partner')) IN ('pro','core','premier') THEN p.instagram_url END,
    'facebook_url',CASE WHEN lower(coalesce(p.plan,'partner')) IN ('pro','core','premier') THEN p.facebook_url END,
    'linkedin_url',CASE WHEN lower(coalesce(p.plan,'partner')) IN ('pro','core','premier') THEN p.linkedin_url END,
    'welcome_video_url',CASE WHEN lower(coalesce(p.plan,'partner'))='premier' THEN p.welcome_video_url END,
    'video_url',CASE WHEN lower(coalesce(p.plan,'partner'))='premier' THEN p.video_url END,
    'app_icon_initials',CASE WHEN lower(coalesce(p.plan,'partner'))='premier' THEN p.app_icon_initials END,
    'app_initials',CASE WHEN lower(coalesce(p.plan,'partner'))='premier' THEN p.app_initials END)
  FROM public.profiles p WHERE p.slug=hub_slug AND p.is_published=true
    AND length(hub_slug) BETWEEN 1 AND 63;
$function$;
REVOKE ALL ON FUNCTION public.get_public_realtor_profile(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_realtor_profile(text) TO anon,authenticated,service_role;

-- Raw profile reads remain owner-only through the existing owner SELECT policy.
-- Public callers use the published-only allowlisted projection, including when
-- they happen to be signed into a different Realtor account.
DROP POLICY "Public can view published profiles" ON public.profiles;

ALTER POLICY "Public can view vendors for published profiles" ON public.vendors
  USING (is_active=true AND public.is_published_hub(profile_id));
ALTER POLICY "Public can view active Pro custom hub sections" ON public.custom_hub_sections
  USING (is_active=true AND public.is_published_hub(profile_id,'premier'));
ALTER POLICY "Public can view active Pro checklist items" ON public.homeowner_checklist_items
  USING (is_active=true AND public.is_published_hub(profile_id,'premier'));
ALTER POLICY "Public can read published emergency assignments" ON public.emergency_service_assignments
  USING (public.is_published_hub(profile_id));
ALTER POLICY "Public can record published hub activity" ON public.hub_activity_events
  WITH CHECK (public.is_published_hub(profile_id));

COMMIT;
