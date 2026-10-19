BEGIN;
CREATE FUNCTION close_relax_private.ingest_hub_activity(payload jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  target uuid; device uuid; event_name text; event_source text; hub_slug text;
  received_at timestamptz := statement_timestamp(); headers jsonb;
BEGIN
  IF jsonb_typeof(payload) IS DISTINCT FROM 'object' OR octet_length(payload::text)>512 THEN RETURN false; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(payload))<>4
    OR NOT payload ?& ARRAY['profile_id','device_id','event_type','source'] THEN RETURN false; END IF;
  IF jsonb_typeof(payload->'profile_id') IS DISTINCT FROM 'string'
    OR jsonb_typeof(payload->'device_id') IS DISTINCT FROM 'string'
    OR jsonb_typeof(payload->'event_type') IS DISTINCT FROM 'string'
    OR jsonb_typeof(payload->'source') IS DISTINCT FROM 'string' THEN RETURN false; END IF;
  IF (payload->>'profile_id') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR (payload->>'device_id') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN RETURN false; END IF;
  target := (payload->>'profile_id')::uuid; device := (payload->>'device_id')::uuid;
  event_name := payload->>'event_type'; event_source := payload->>'source';
  IF NOT (
    (event_name='hub_view' AND event_source='public_hub') OR
    (event_name='standalone_open' AND event_source='installed_hub') OR
    (event_name IN ('save_click','install_accepted','ios_instructions') AND event_source IN ('main_button','floating_button')) OR
    (event_name IN ('savings_vivint_click','savings_goosehead_click') AND event_source='homeowner_savings')
  ) THEN RETURN false; END IF;
  headers := coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
  SELECT p.slug INTO hub_slug FROM public.profiles p WHERE p.id=target AND p.is_published=true AND p.slug IS NOT NULL FOR SHARE;
  IF NOT FOUND OR headers->>'origin' IS DISTINCT FROM 'https://'||hub_slug||'.closeandrelax.com' THEN RETURN false; END IF;
  -- Origin is a consistency check, not proof of identity. Caps also apply when
  -- a caller forges headers or rotates client-generated device IDs.
  IF NOT pg_try_advisory_xact_lock(hashtextextended('hub-activity:'||target::text,0)) THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM public.hub_activity_events e WHERE e.profile_id=target AND e.device_id=device
      AND e.event_type=event_name AND e.created_at>received_at-interval '5 minutes') THEN RETURN false; END IF;
  IF (SELECT count(*) FROM public.hub_activity_events e WHERE e.profile_id=target AND e.device_id=device
      AND e.created_at>received_at-interval '1 hour')>=30 THEN RETURN false; END IF;
  IF (SELECT count(*) FROM public.hub_activity_events e WHERE e.profile_id=target
      AND e.created_at>received_at-interval '24 hours')>=500 THEN RETURN false; END IF;
  -- Keep at most 5,000 rows per hub, even without an automated retention job.
  -- Expired records for this hub are removed only after a valid request reaches
  -- this point. Dormant hubs require the documented administrator pruning pass.
  DELETE FROM public.hub_activity_events WHERE profile_id=target AND created_at<received_at-interval '90 days';
  IF (SELECT count(*) FROM public.hub_activity_events e WHERE e.profile_id=target)>=5000 THEN RETURN false; END IF;
  INSERT INTO public.hub_activity_events(profile_id,device_id,event_type,source,created_at)
    VALUES(target,device,event_name,event_source,received_at);
  RETURN true;
EXCEPTION WHEN invalid_text_representation THEN RETURN false;
END;
$function$;
REVOKE ALL ON FUNCTION close_relax_private.ingest_hub_activity(jsonb) FROM PUBLIC,anon,authenticated,service_role;

-- Deliberately public write-only wrapper. Private implementation is not directly
-- executable by API roles and returns no event rows, identifiers or profile data.
CREATE FUNCTION public.record_hub_activity(payload jsonb)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $function$ SELECT close_relax_private.ingest_hub_activity(payload); $function$;
REVOKE ALL ON FUNCTION public.record_hub_activity(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.record_hub_activity(jsonb) TO anon,authenticated;

DROP POLICY "Public can record published hub activity" ON public.hub_activity_events;
REVOKE ALL PRIVILEGES ON public.hub_activity_events FROM PUBLIC,anon,authenticated;
DO $block$
DECLARE columns text;
BEGIN
  SELECT string_agg(quote_ident(attname),',') INTO columns FROM pg_attribute
    WHERE attrelid='public.hub_activity_events'::regclass AND attnum>0 AND NOT attisdropped;
  EXECUTE format('REVOKE ALL PRIVILEGES (%s) ON public.hub_activity_events FROM PUBLIC,anon,authenticated',columns);
END;
$block$;
-- Preserve existing owner-only dashboard reads. No UPDATE/DELETE/TRUNCATE grants.
GRANT SELECT ON public.hub_activity_events TO authenticated;
ALTER TABLE public.hub_activity_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX hub_activity_events_dedupe_idx ON public.hub_activity_events(profile_id,device_id,event_type,created_at DESC);
COMMIT;
