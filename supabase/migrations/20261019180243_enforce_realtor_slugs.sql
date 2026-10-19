-- No existing URLs are rewritten. Validation aborts if a preflight conflict exists.
BEGIN;
CREATE FUNCTION public.is_valid_realtor_slug(candidate text)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = ''
AS $function$
  SELECT coalesce(
    length(candidate) BETWEEN 1 AND 63
    AND candidate COLLATE "C" !~ '[^a-z0-9-]'
    AND candidate COLLATE "C" ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'
    AND candidate <> ALL (ARRAY[
      'www', 'app', 'admin', 'api', 'auth', 'login', 'logout', 'signup',
      'dashboard', 'support', 'billing', 'insurance', 'mail', 'smtp', 'ftp',
      'static', 'assets', 'cdn', 'status', 'account', 'accounts', 'settings',
      'contact', 'help', 'pricing', 'plans', 'benefits', 'privacy', 'terms',
      'reset-password', 'forgot-password', 'verify', 'oauth', 'callback',
      'webmail', 'autodiscover', 'imap', 'pop', 'pop3', 'mx', 'dns', 'ns1', 'ns2',
      'dev', 'test', 'staging', 'preview', 'localhost', 'closeandrelax'
    ]::text[]), false);
$function$;
REVOKE ALL ON FUNCTION public.is_valid_realtor_slug(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.is_valid_realtor_slug(text) TO anon,authenticated,service_role;

-- NULL is intentional only for an unpublished account awaiting setup.
ALTER TABLE public.profiles ADD CONSTRAINT profiles_slug_canonical_check CHECK (
  (slug IS NULL AND is_published IS NOT TRUE) OR public.is_valid_realtor_slug(slug)
);

CREATE FUNCTION public.enforce_profile_slug()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.slug IS NOT NULL AND NEW.slug IS NULL THEN
    RAISE EXCEPTION 'Choose a new subdomain instead of clearing your existing hub URL.' USING ERRCODE = '23514';
  END IF;
  IF NEW.slug IS NULL AND NEW.is_published IS TRUE THEN
    RAISE EXCEPTION 'Choose a valid Realtor subdomain before publishing.' USING ERRCODE = '23514';
  END IF;
  IF NEW.slug IS NOT NULL AND NOT public.is_valid_realtor_slug(NEW.slug) THEN
    RAISE EXCEPTION 'Use 1–63 lowercase letters, numbers, or hyphens, with no hyphens at either end. Platform subdomains are reserved.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.enforce_profile_slug() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER enforce_profile_slug_before_write BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_slug();
-- Existing profiles_slug_key uniqueness and owner RLS are unchanged.
COMMIT;
