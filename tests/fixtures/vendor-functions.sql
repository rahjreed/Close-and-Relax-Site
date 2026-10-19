-- Test-only snapshot of the seven production vendor functions inspected on 2026-10-19.
-- No homeowner data or credentials. Apply only to the in-memory regression database.

CREATE OR REPLACE FUNCTION public.add_standard_close_relax_vendor(target_profile_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (
    select 1
    from public.vendors
    where profile_id = target_profile_id
      and is_default = true
      and name = 'Roger With Vivint'
  ) then
    insert into public.vendors (
      profile_id,
      name,
      category,
      phone,
      website,
      recommendation,
      sort_order,
      is_active,
      is_default
    )
    values (
      target_profile_id,
      'Roger With Vivint',
      'Smart Home & Security',
      '463-281-3454',
      'https://rogerwithvivint.com',
      null,
      0,
      true,
      true
    );
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_vendor_plan_rules()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  custom_vendor_count integer;
  allowed_vendor_count integer;
begin
  if tg_op = 'INSERT' then
    if new.is_default = false then
      allowed_vendor_count := public.vendor_plan_limit(new.profile_id);

      if allowed_vendor_count is null then
        raise exception 'Unable to determine vendor limit for this profile.';
      end if;

      select count(*)
      into custom_vendor_count
      from public.vendors v
      where v.profile_id = new.profile_id
        and v.is_default = false;

      if custom_vendor_count >= allowed_vendor_count then
        raise exception 'Your current plan allows up to % custom vendors.', allowed_vendor_count;
      end if;

      if
        coalesce(trim(new.recommendation), '') <> ''
        and not coalesce(public.vendor_plan_allows_recommendations(new.profile_id), false)
      then
        raise exception 'Vendor recommendation notes require Core or Pro.';
      end if;
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.profile_id is distinct from old.profile_id then
      raise exception 'A vendor cannot be moved to another profile.';
    end if;

    if new.is_default is distinct from old.is_default then
      raise exception 'The default vendor designation cannot be changed.';
    end if;

    if
      old.is_default = true
      and not coalesce(public.vendor_plan_allows_default_control(old.profile_id), false)
    then
      raise exception 'The standard Close & Relax vendor can only be edited on Pro.';
    end if;

    if
      old.is_default = false
      and coalesce(trim(new.recommendation), '') <> ''
      and not coalesce(public.vendor_plan_allows_recommendations(new.profile_id), false)
    then
      raise exception 'Vendor recommendation notes require Core or Pro.';
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    if
      old.is_default = true
      and not coalesce(public.vendor_plan_allows_default_control(old.profile_id), false)
    then
      raise exception 'The standard Close & Relax vendor can only be removed on Pro.';
    end if;

    return old;
  end if;

  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_profile_standard_vendor()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.add_standard_close_relax_vendor(new.id);
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.restore_close_relax_standard_vendor()
 RETURNS vendors
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller_id uuid;
  caller_plan text;
  existing_vendor public.vendors;
  restored_vendor public.vendors;
  next_sort integer;
begin
  caller_id := auth.uid();

  if caller_id is null then
    raise exception 'You must be signed in.';
  end if;

  select lower(coalesce(plan, 'partner'))
  into caller_plan
  from public.profiles
  where id = caller_id;

  if caller_plan is distinct from 'premier' then
    raise exception 'Restoring the standard Close & Relax resource requires Pro.';
  end if;

  select *
  into existing_vendor
  from public.vendors
  where profile_id = caller_id
    and is_default = true
  order by created_at asc
  limit 1;

  if found then
    return existing_vendor;
  end if;

  select coalesce(max(sort_order), 0) + 1
  into next_sort
  from public.vendors
  where profile_id = caller_id;

  insert into public.vendors (
    profile_id,
    name,
    category,
    phone,
    website,
    recommendation,
    sort_order,
    is_active,
    is_default
  )
  values (
    caller_id,
    'Roger With Vivint',
    'Smart Home & Security',
    '463-281-3454',
    'https://rogerwithvivint.com',
    null,
    next_sort,
    true,
    true
  )
  returning *
  into restored_vendor;

  return restored_vendor;
end;
$function$;

CREATE OR REPLACE FUNCTION public.vendor_plan_allows_default_control(target_profile_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select lower(coalesce(p.plan, 'partner')) = 'premier'
  from public.profiles p
  where p.id = target_profile_id
$function$;

CREATE OR REPLACE FUNCTION public.vendor_plan_allows_recommendations(target_profile_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select lower(coalesce(p.plan, 'partner')) in ('pro', 'core', 'premier')
  from public.profiles p
  where p.id = target_profile_id
$function$;

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

