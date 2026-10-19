-- Exact function body and trigger inspected read-only in production 2026-10-19.
CREATE OR REPLACE FUNCTION public.set_vendor_updated_at()
RETURNS trigger LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;
GRANT EXECUTE ON FUNCTION public.set_vendor_updated_at() TO PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER set_vendor_updated_at BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.set_vendor_updated_at();
