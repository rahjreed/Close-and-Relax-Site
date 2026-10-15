-- Update only the live vendor-limit helper; preserve its signature and settings.
BEGIN;

CREATE OR REPLACE FUNCTION public.vendor_plan_limit(target_profile_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when lower(coalesce(p.plan, 'partner')) = 'premier' then 30
    when lower(coalesce(p.plan, 'partner')) in ('pro', 'core') then 15
    else 5
  end
  from public.profiles p
  where p.id = target_profile_id
$function$;

COMMIT;
