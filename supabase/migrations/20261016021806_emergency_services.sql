-- Emergency contacts are independent of public.vendors and its plan limits.
BEGIN;

CREATE TABLE public.emergency_service_categories (
  code text PRIMARY KEY CHECK (code IN ('plumbing', 'heating-cooling', 'electrical', 'locksmith', 'fire-water-restoration', 'roofing-storm-damage')),
  label text NOT NULL CHECK (length(btrim(label)) > 0),
  sort_order integer NOT NULL UNIQUE CHECK (sort_order BETWEEN 1 AND 6)
);

INSERT INTO public.emergency_service_categories (code, label, sort_order) VALUES
  ('plumbing', 'Plumbing', 1),
  ('heating-cooling', 'Heating & Cooling', 2),
  ('electrical', 'Electrical', 3),
  ('locksmith', 'Locksmith', 4),
  ('fire-water-restoration', 'Fire & Water Restoration', 5),
  ('roofing-storm-damage', 'Roofing / Storm Damage', 6);

CREATE TABLE public.emergency_service_assignments (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_code text NOT NULL REFERENCES public.emergency_service_categories(code),
  provider_name text NOT NULL CHECK (length(btrim(provider_name)) BETWEEN 1 AND 160),
  phone text NOT NULL CHECK (
    length(phone) <= 50 AND phone ~ '^[+0-9().[:space:]-]+$'
    AND length(regexp_replace(phone, '[^0-9]', '', 'g')) BETWEEN 7 AND 15
  ),
  website text CHECK (website IS NULL OR (
    length(website) <= 2048 AND website ~* '^https?://[^[:space:]/@?#]+([/?#][^[:space:]]*)?$'
  )),
  availability_status text NOT NULL DEFAULT 'unknown' CHECK (availability_status IN ('unknown', 'confirmed_24_7')),
  availability_confirmation_method text CHECK (availability_confirmation_method IN ('provider_confirmation', 'business_website')),
  availability_confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, category_code),
  CONSTRAINT emergency_availability_confirmation_consistent CHECK (
    (availability_status = 'unknown' AND availability_confirmation_method IS NULL AND availability_confirmed_at IS NULL)
    OR (availability_status = 'confirmed_24_7' AND availability_confirmation_method IS NOT NULL AND availability_confirmed_at IS NOT NULL)
  )
);

CREATE FUNCTION public.validate_emergency_service_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  NEW.provider_name := btrim(NEW.provider_name);
  NEW.phone := btrim(NEW.phone);
  NEW.website := nullif(btrim(NEW.website), '');
  IF TG_OP = 'UPDATE' THEN
    IF NEW.profile_id IS DISTINCT FROM OLD.profile_id OR NEW.category_code IS DISTINCT FROM OLD.category_code THEN
      RAISE EXCEPTION 'Emergency assignments cannot be moved to another profile or category.';
    END IF;
    NEW.created_at := OLD.created_at;
    IF NEW.provider_name IS DISTINCT FROM OLD.provider_name
       OR NEW.phone IS DISTINCT FROM OLD.phone
       OR NEW.website IS DISTINCT FROM OLD.website THEN
      -- A prior confirmation must not carry over to a different contact.
      NEW.availability_status := 'unknown';
    END IF;
  ELSE
    NEW.created_at := now();
  END IF;
  IF NEW.availability_status = 'confirmed_24_7' THEN
    IF NEW.availability_confirmation_method IS NULL THEN
      RAISE EXCEPTION 'Explicitly confirm how this provider offers 24/7 availability.';
    END IF;
    NEW.availability_confirmed_at := now();
  ELSE
    NEW.availability_confirmation_method := NULL;
    NEW.availability_confirmed_at := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER validate_emergency_service_assignment_before_write
BEFORE INSERT OR UPDATE ON public.emergency_service_assignments
FOR EACH ROW EXECUTE FUNCTION public.validate_emergency_service_assignment();

ALTER TABLE public.emergency_service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_service_assignments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.emergency_service_categories FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.emergency_service_assignments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.emergency_service_categories TO anon, authenticated;
GRANT SELECT ON public.emergency_service_assignments TO anon, authenticated;
-- Audit timestamps are server-managed. Category definitions are platform-owned.
GRANT INSERT (profile_id, category_code, provider_name, phone, website, availability_status, availability_confirmation_method)
  ON public.emergency_service_assignments TO authenticated;
-- PostgREST upserts include the conflict-key columns in their UPDATE. The
-- trigger rejects any actual key change, and RLS still enforces ownership.
GRANT UPDATE (profile_id, category_code, provider_name, phone, website, availability_status, availability_confirmation_method)
  ON public.emergency_service_assignments TO authenticated;
GRANT DELETE ON public.emergency_service_assignments TO authenticated;
REVOKE ALL ON FUNCTION public.validate_emergency_service_assignment() FROM PUBLIC, anon, authenticated;

CREATE POLICY "Public can read emergency categories"
  ON public.emergency_service_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Owners can read emergency assignments"
  ON public.emergency_service_assignments FOR SELECT TO authenticated
  USING (profile_id = (SELECT auth.uid()));
CREATE POLICY "Public can read published emergency assignments"
  ON public.emergency_service_assignments FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.is_published = true));
CREATE POLICY "Owners can create emergency assignments"
  ON public.emergency_service_assignments FOR INSERT TO authenticated
  WITH CHECK (profile_id = (SELECT auth.uid()));
CREATE POLICY "Owners can update emergency assignments"
  ON public.emergency_service_assignments FOR UPDATE TO authenticated
  USING (profile_id = (SELECT auth.uid())) WITH CHECK (profile_id = (SELECT auth.uid()));
CREATE POLICY "Owners can clear emergency assignments"
  ON public.emergency_service_assignments FOR DELETE TO authenticated
  USING (profile_id = (SELECT auth.uid()));

COMMIT;
