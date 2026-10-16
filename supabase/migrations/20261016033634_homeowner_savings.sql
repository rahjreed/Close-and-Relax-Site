-- Homeowner offers are platform-owned; preferred vendors and emergency slots
-- remain independent. This migration does not alter pricing or vendor limits.
BEGIN;

CREATE TABLE public.homeowner_savings_offers (
  code text PRIMARY KEY CHECK (code IN ('vivint', 'goosehead')),
  cta_url text CHECK ((code = 'vivint' OR cta_url IS NULL) AND (cta_url IS NULL OR (
    length(cta_url) <= 2048
    AND cta_url ~* '^https?://[^[:space:]/@?#]+([/?#][^[:space:]]*)?$'
  )))
);

-- The owner approved using the existing Vivint Calendly destination for
-- homeowners. Copy the configured URL, without duplicating benefit/discount copy.
-- Goosehead always uses the internal private lead request form.
INSERT INTO public.homeowner_savings_offers (code, cta_url) VALUES
  ('vivint', (SELECT claim_url FROM public.realtor_benefits WHERE slug = 'vivint-member-discount' LIMIT 1)),
  ('goosehead', NULL);

ALTER TABLE public.homeowner_savings_offers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.homeowner_savings_offers FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.homeowner_savings_offers TO anon, authenticated;
CREATE POLICY "Public can read homeowner savings offers"
  ON public.homeowner_savings_offers FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.profiles
  ADD COLUMN homeowner_savings_visible boolean NOT NULL DEFAULT true;

CREATE FUNCTION public.enforce_homeowner_savings_visibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  IF lower(coalesce(NEW.plan, 'partner')) <> 'premier' THEN
    NEW.homeowner_savings_visible := true;
  ELSE
    NEW.homeowner_savings_visible := coalesce(NEW.homeowner_savings_visible, true);
  END IF;
  RETURN NEW;
END;
$function$;

-- PostgreSQL runs same-event triggers alphabetically. Run after the existing
-- protect_profile_plan_* triggers so browser signups cannot spoof a Pro plan.
CREATE TRIGGER zz_enforce_homeowner_savings_visibility_before_write
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_homeowner_savings_visibility();
REVOKE ALL ON FUNCTION public.enforce_homeowner_savings_visibility() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_homeowner_savings_visibility_check
  CHECK (lower(coalesce(plan, 'partner')) = 'premier' OR homeowner_savings_visible = true);
-- Existing owner/public profile RLS continues to control which rows are visible
-- and writable. No existing profile policies or plan-protection code is replaced.
GRANT SELECT (homeowner_savings_visible) ON public.profiles TO anon, authenticated;
GRANT UPDATE (homeowner_savings_visible) ON public.profiles TO authenticated;

-- Preserve every currently allowed event and add only two savings CTA events.
ALTER TABLE public.hub_activity_events DROP CONSTRAINT hub_activity_events_event_type_check;
ALTER TABLE public.hub_activity_events ADD CONSTRAINT hub_activity_events_event_type_check
  CHECK (event_type IN (
    'hub_view', 'save_click', 'install_accepted', 'standalone_open', 'ios_instructions',
    'savings_vivint_click', 'savings_goosehead_click'
  ));

-- Private storage is outside the Data API. No browser or Edge role receives
-- table privileges. RLS denies direct access; narrow functions are the only API.
CREATE SCHEMA close_relax_private;
REVOKE ALL ON SCHEMA close_relax_private FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA close_relax_private TO authenticated, service_role;

-- Provision verified Auth user UUIDs only through a trusted administrative SQL
-- session. No default admin, email match, plan, or user-editable metadata grant.
CREATE TABLE close_relax_private.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE close_relax_private.platform_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON close_relax_private.platform_admins FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE close_relax_private.goosehead_homeowner_leads (
  id uuid PRIMARY KEY,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  referring_realtor_name text,
  full_name text NOT NULL CHECK (length(btrim(full_name)) BETWEEN 1 AND 160),
  phone text NOT NULL CHECK (phone ~ '^[+0-9().[:space:]-]+$' AND length(phone) <= 50 AND length(regexp_replace(phone,'[^0-9]','','g')) BETWEEN 7 AND 15),
  address text NOT NULL CHECK (length(btrim(address)) BETWEEN 1 AND 500),
  email text NOT NULL CHECK (length(email) <= 254 AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  callback_date date NOT NULL,
  callback_window text NOT NULL CHECK (callback_window IN ('11am-3pm','3pm-7pm','7pm-11pm')),
  callback_timezone text NOT NULL CHECK (length(callback_timezone) BETWEEN 1 AND 100),
  contact_consent boolean NOT NULL CHECK (contact_consent = true),
  requester_hash text NOT NULL CHECK (requester_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','closed','not_interested')),
  status_updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX goosehead_leads_requester_created_idx ON close_relax_private.goosehead_homeowner_leads(requester_hash,created_at);
CREATE INDEX goosehead_leads_created_idx ON close_relax_private.goosehead_homeowner_leads(created_at DESC,id DESC);
ALTER TABLE close_relax_private.goosehead_homeowner_leads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON close_relax_private.goosehead_homeowner_leads FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION close_relax_private.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM close_relax_private.platform_admins a WHERE a.user_id=auth.uid()
  );
$function$;
CREATE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $function$ SELECT close_relax_private.is_platform_admin(); $function$;
REVOKE ALL ON FUNCTION close_relax_private.is_platform_admin(), public.is_platform_admin() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION close_relax_private.is_platform_admin(), public.is_platform_admin() TO authenticated;

-- Trusted Edge Function only. It validates CAPTCHA/origin/fields before calling
-- this creation-only API; the service role cannot SELECT the private table.
CREATE FUNCTION close_relax_private.submit_goosehead_homeowner_lead(lead jsonb, client_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  request_id uuid := (lead->>'request_id')::uuid;
  existing_hash text;
  realtor_name text;
BEGIN
  IF client_hash IS NULL OR client_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invalid request.'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(client_hash,0));
  SELECT l.requester_hash INTO existing_hash FROM close_relax_private.goosehead_homeowner_leads l WHERE l.id=request_id;
  IF FOUND THEN
    IF existing_hash IS DISTINCT FROM client_hash THEN RAISE EXCEPTION 'Invalid request.'; END IF;
    RETURN request_id;
  END IF;
  SELECT p.full_name INTO realtor_name FROM public.profiles p
    WHERE p.id=(lead->>'profile_id')::uuid AND p.is_published=true
    AND (lower(coalesce(p.plan,'partner')) <> 'premier' OR p.homeowner_savings_visible=true);
  IF NOT FOUND THEN RAISE EXCEPTION 'This homeowner request is unavailable.'; END IF;
  IF (SELECT count(*) FROM close_relax_private.goosehead_homeowner_leads l WHERE l.requester_hash=client_hash AND l.created_at > now()-interval '1 hour') >= 5 THEN
    RAISE EXCEPTION 'Too many requests. Please try again later.';
  END IF;
  IF (lead->>'callback_date')::date < (now() AT TIME ZONE (lead->>'callback_timezone'))::date THEN
    RAISE EXCEPTION 'Choose a current or future callback date.';
  END IF;
  INSERT INTO close_relax_private.goosehead_homeowner_leads(id,profile_id,referring_realtor_name,full_name,phone,address,email,callback_date,callback_window,callback_timezone,contact_consent,requester_hash)
  VALUES(request_id,(lead->>'profile_id')::uuid,realtor_name,lead->>'full_name',lead->>'phone',lead->>'address',lead->>'email',(lead->>'callback_date')::date,
    lead->>'callback_window',lead->>'callback_timezone',(lead->>'contact_consent')::boolean,client_hash);
  RETURN request_id;
END;
$function$;
CREATE FUNCTION public.submit_goosehead_homeowner_lead(lead jsonb, client_hash text)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $function$ SELECT close_relax_private.submit_goosehead_homeowner_lead(lead,client_hash); $function$;
REVOKE ALL ON FUNCTION close_relax_private.submit_goosehead_homeowner_lead(jsonb,text), public.submit_goosehead_homeowner_lead(jsonb,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION close_relax_private.submit_goosehead_homeowner_lead(jsonb,text), public.submit_goosehead_homeowner_lead(jsonb,text) TO service_role;

CREATE FUNCTION close_relax_private.list_insurance_leads(page_size integer, page_offset integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE result jsonb;
BEGIN
  IF NOT close_relax_private.is_platform_admin() THEN RAISE EXCEPTION 'Administrator access required.' USING ERRCODE='42501'; END IF;
  IF page_size IS NULL OR page_size NOT BETWEEN 1 AND 100 OR page_offset IS NULL OR page_offset < 0 THEN
    RAISE EXCEPTION 'Invalid page.';
  END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC,r.id DESC),'[]'::jsonb) INTO result FROM (
    SELECT l.id,l.profile_id,coalesce(nullif(p.full_name,''),l.referring_realtor_name) AS referring_realtor_name,
      l.full_name,l.phone,l.email,l.address,l.callback_date,l.callback_window,l.callback_timezone,l.created_at,l.status,l.status_updated_at
    FROM close_relax_private.goosehead_homeowner_leads l LEFT JOIN public.profiles p ON p.id=l.profile_id
    ORDER BY l.created_at DESC,l.id DESC LIMIT page_size OFFSET page_offset
  ) r;
  RETURN result;
END;
$function$;
CREATE FUNCTION public.list_insurance_leads(page_size integer DEFAULT 50,page_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $function$ SELECT close_relax_private.list_insurance_leads(page_size,page_offset); $function$;

CREATE FUNCTION close_relax_private.update_insurance_lead_status(lead_id uuid, new_status text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  IF NOT close_relax_private.is_platform_admin() THEN RAISE EXCEPTION 'Administrator access required.' USING ERRCODE='42501'; END IF;
  IF new_status IS NULL OR new_status NOT IN ('new','contacted','qualified','closed','not_interested') THEN RAISE EXCEPTION 'Invalid lead status.'; END IF;
  UPDATE close_relax_private.goosehead_homeowner_leads SET status=new_status,status_updated_at=now() WHERE id=lead_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found.'; END IF;
  RETURN new_status;
END;
$function$;
CREATE FUNCTION public.update_insurance_lead_status(lead_id uuid,new_status text)
RETURNS text LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $function$ SELECT close_relax_private.update_insurance_lead_status(lead_id,new_status); $function$;
REVOKE ALL ON FUNCTION close_relax_private.list_insurance_leads(integer,integer), public.list_insurance_leads(integer,integer), close_relax_private.update_insurance_lead_status(uuid,text), public.update_insurance_lead_status(uuid,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION close_relax_private.list_insurance_leads(integer,integer), public.list_insurance_leads(integer,integer), close_relax_private.update_insurance_lead_status(uuid,text), public.update_insurance_lead_status(uuid,text) TO authenticated;

COMMIT;
