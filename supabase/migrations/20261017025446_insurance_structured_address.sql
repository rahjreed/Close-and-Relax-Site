-- Add private structured property fields without guessing parts of legacy addresses.
-- Historical all-NULL parts remain valid for legacy lead status updates.
BEGIN;
ALTER TABLE close_relax_private.goosehead_homeowner_leads
  ADD COLUMN street_address text CHECK (street_address IS NULL OR length(btrim(street_address)) BETWEEN 1 AND 200),
  ADD COLUMN apt_unit text CHECK (apt_unit IS NULL OR length(btrim(apt_unit)) BETWEEN 1 AND 50),
  ADD COLUMN city text CHECK (city IS NULL OR length(btrim(city)) BETWEEN 1 AND 100),
  ADD COLUMN state text CHECK (state IS NULL OR state IN ('AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','AS','GU','MP','PR','VI','AA','AE','AP')),
  ADD COLUMN zip_code text CHECK (zip_code IS NULL OR zip_code ~ '^[0-9]{5}(-[0-9]{4})?$'),
  ADD CONSTRAINT goosehead_leads_structured_address_check CHECK (
    (street_address IS NULL AND apt_unit IS NULL AND city IS NULL AND state IS NULL AND zip_code IS NULL)
    OR (insurance_type IN ('home','home_and_auto') AND street_address IS NOT NULL AND city IS NOT NULL AND state IS NOT NULL AND zip_code IS NOT NULL)
  );

-- Only this service-only creation RPC writes new leads. It requires all home
-- address parts, strips auto address data and derives the legacy display string.
CREATE OR REPLACE FUNCTION close_relax_private.submit_goosehead_homeowner_lead(lead jsonb, client_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  request_id uuid := (lead->>'request_id')::uuid;
  existing_hash text;
  realtor_name text;
  referral_id uuid := nullif(lead->>'profile_id','')::uuid;
  requested_type text := coalesce(lead->>'insurance_type','home');
  property_street text; property_unit text; property_city text; property_state text; property_zip text; property_display text;
BEGIN
  IF client_hash IS NULL OR client_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invalid request.'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(client_hash,0));
  SELECT l.requester_hash INTO existing_hash FROM close_relax_private.goosehead_homeowner_leads l WHERE l.id=request_id;
  IF FOUND THEN
    IF existing_hash IS DISTINCT FROM client_hash THEN RAISE EXCEPTION 'Invalid request.'; END IF;
    RETURN request_id;
  END IF;
  IF referral_id IS NOT NULL THEN
    SELECT p.full_name INTO realtor_name FROM public.profiles p
      WHERE p.id=referral_id AND p.is_published=true
      AND (lower(coalesce(p.plan,'partner')) <> 'premier' OR p.homeowner_savings_visible=true);
    IF NOT FOUND THEN RAISE EXCEPTION 'This referral is unavailable. Open /insurance without a referral to continue.'; END IF;
  END IF;
  IF (SELECT count(*) FROM close_relax_private.goosehead_homeowner_leads l WHERE l.requester_hash=client_hash AND l.created_at > now()-interval '1 hour') >= 5 THEN
    RAISE EXCEPTION 'Too many requests. Please try again later.';
  END IF;
  IF (lead->>'callback_date')::date < (now() AT TIME ZONE (lead->>'callback_timezone'))::date THEN
    RAISE EXCEPTION 'Choose a current or future callback date.';
  END IF;
  IF requested_type <> 'auto' THEN
    property_street := nullif(btrim(lead->>'street_address'),'');
    property_unit := nullif(btrim(lead->>'apt_unit'),'');
    property_city := nullif(btrim(lead->>'city'),'');
    property_state := upper(nullif(btrim(lead->>'state'),''));
    property_zip := nullif(btrim(lead->>'zip_code'),'');
    IF property_street IS NULL OR property_city IS NULL OR property_state IS NULL OR property_zip IS NULL THEN
      RAISE EXCEPTION 'Enter a complete property address.';
    END IF;
    property_display := concat_ws(', ',property_street,property_unit,property_city,property_state || ' ' || property_zip);
  END IF;
  INSERT INTO close_relax_private.goosehead_homeowner_leads(id,profile_id,referring_realtor_name,insurance_type,full_name,phone,address,street_address,apt_unit,city,state,zip_code,email,callback_date,callback_window,callback_timezone,contact_consent,requester_hash)
  VALUES(request_id,referral_id,realtor_name,requested_type,lead->>'full_name',lead->>'phone',property_display,property_street,property_unit,property_city,property_state,property_zip,lead->>'email',(lead->>'callback_date')::date,
    lead->>'callback_window',lead->>'callback_timezone',(lead->>'contact_consent')::boolean,client_hash);
  RETURN request_id;
END;
$function$;
CREATE OR REPLACE FUNCTION close_relax_private.list_insurance_leads(page_size integer, page_offset integer)
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
      l.insurance_type,l.full_name,l.phone,l.email,l.address,l.street_address,l.apt_unit,l.city,l.state,l.zip_code,l.callback_date,l.callback_window,l.callback_timezone,l.created_at,l.status,l.status_updated_at
    FROM close_relax_private.goosehead_homeowner_leads l LEFT JOIN public.profiles p ON p.id=l.profile_id
    ORDER BY l.created_at DESC,l.id DESC LIMIT page_size OFFSET page_offset
  ) r;
  RETURN result;
END;
$function$;

COMMIT;
