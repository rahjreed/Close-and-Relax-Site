-- TEST ONLY: production-shaped core schema/function/policy snapshot, read-only catalog inspection 2026-10-19.
-- No production rows, secrets, SMTP, Vault, cron, networking, Storage runtime or real Auth sessions.
-- The rehearsal adds the six approved historical feature migrations in isolation.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role;
REVOKE CREATE ON SCHEMA public FROM PUBLIC,anon,authenticated;
-- Public-schema default grants inspected read-only in production on 2026-10-19.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}',created_at timestamptz DEFAULT now(),email_confirmed_at timestamptz,is_anonymous boolean DEFAULT false,deleted_at timestamptz);

CREATE TABLE public."profiles" (
id uuid NOT NULL,
created_at timestamp with time zone DEFAULT now() NOT NULL,
slug text,
full_name text,
email text,
phone text,
brokerage text,
photo_url text,
bio text,
title text,
city text,
state text,
website_url text,
facebook_url text,
instagram_url text,
linkedin_url text,
video_url text,
app_initials text,
plan text DEFAULT 'free'::text,
is_published boolean DEFAULT false,
updated_at timestamp with time zone DEFAULT now(),
headshot_url text,
welcome_message text,
welcome_video_url text,
app_icon_initials text,
CONSTRAINT "profiles_slug_key" UNIQUE (slug),
CONSTRAINT "profiles_pkey" PRIMARY KEY (id),
CONSTRAINT "profiles_app_icon_initials_check" CHECK (((app_icon_initials IS NULL) OR (((char_length(TRIM(BOTH FROM app_icon_initials)) >= 1) AND (char_length(TRIM(BOTH FROM app_icon_initials)) <= 2)) AND (TRIM(BOTH FROM app_icon_initials) ~ '^[A-Za-z0-9]{1,2}$'::text))))
);
ALTER TABLE public."profiles" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."profiles" TO anon,authenticated,service_role;

CREATE TABLE public."vendors" (
id uuid DEFAULT gen_random_uuid() NOT NULL,
profile_id uuid NOT NULL,
name text NOT NULL,
category text NOT NULL,
phone text,
website text,
recommendation text,
sort_order integer DEFAULT 0 NOT NULL,
is_active boolean DEFAULT true NOT NULL,
is_default boolean DEFAULT false NOT NULL,
created_at timestamp with time zone DEFAULT now() NOT NULL,
updated_at timestamp with time zone DEFAULT now() NOT NULL,
CONSTRAINT "vendors_pkey" PRIMARY KEY (id),
CONSTRAINT "vendors_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);
ALTER TABLE public."vendors" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."vendors" TO anon,authenticated,service_role;

CREATE TABLE public."homeowner_checklist_items" (
id uuid DEFAULT gen_random_uuid() NOT NULL,
profile_id uuid NOT NULL,
title text NOT NULL,
details text,
timeframe text,
sort_order integer DEFAULT 0 NOT NULL,
is_active boolean DEFAULT true NOT NULL,
created_at timestamp with time zone DEFAULT now() NOT NULL,
updated_at timestamp with time zone DEFAULT now() NOT NULL,
recurrence_months integer,
CONSTRAINT "homeowner_checklist_items_pkey" PRIMARY KEY (id),
CONSTRAINT "homeowner_checklist_items_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
CONSTRAINT "homeowner_checklist_items_recurrence_months_check" CHECK (((recurrence_months IS NULL) OR ((recurrence_months >= 1) AND (recurrence_months <= 120))))
);
ALTER TABLE public."homeowner_checklist_items" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."homeowner_checklist_items" TO anon,authenticated,service_role;

CREATE TABLE public."custom_hub_sections" (
id uuid DEFAULT gen_random_uuid() NOT NULL,
profile_id uuid NOT NULL,
title text NOT NULL,
body text,
button_label text,
button_url text,
sort_order integer DEFAULT 0 NOT NULL,
is_active boolean DEFAULT true NOT NULL,
created_at timestamp with time zone DEFAULT now() NOT NULL,
updated_at timestamp with time zone DEFAULT now() NOT NULL,
CONSTRAINT "custom_hub_sections_pkey" PRIMARY KEY (id),
CONSTRAINT "custom_hub_sections_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);
ALTER TABLE public."custom_hub_sections" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."custom_hub_sections" TO anon,authenticated,service_role;

CREATE TABLE public."realtor_benefits" (
id uuid DEFAULT gen_random_uuid() NOT NULL,
slug text NOT NULL,
provider text NOT NULL,
title text NOT NULL,
short_description text,
benefit_details text,
eligibility text,
claim_label text DEFAULT 'Claim Benefit'::text NOT NULL,
claim_url text,
eligible_plans text[] DEFAULT ARRAY['partner'::text, 'pro'::text, 'premier'::text] NOT NULL,
sort_order integer DEFAULT 0 NOT NULL,
is_active boolean DEFAULT true NOT NULL,
created_at timestamp with time zone DEFAULT now() NOT NULL,
updated_at timestamp with time zone DEFAULT now() NOT NULL,
CONSTRAINT "realtor_benefits_slug_key" UNIQUE (slug),
CONSTRAINT "realtor_benefits_pkey" PRIMARY KEY (id)
);
ALTER TABLE public."realtor_benefits" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."realtor_benefits" TO anon,authenticated,service_role;

CREATE TABLE public."hub_activity_events" (
id uuid DEFAULT gen_random_uuid() NOT NULL,
profile_id uuid NOT NULL,
event_type text NOT NULL,
source text,
device_id uuid NOT NULL,
created_at timestamp with time zone DEFAULT now() NOT NULL,
CONSTRAINT "hub_activity_events_pkey" PRIMARY KEY (id),
CONSTRAINT "hub_activity_events_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
CONSTRAINT "hub_activity_events_event_type_check" CHECK ((event_type = ANY (ARRAY['hub_view'::text, 'save_click'::text, 'install_accepted'::text, 'standalone_open'::text, 'ios_instructions'::text, 'savings_vivint_click'::text, 'savings_goosehead_click'::text]))),
CONSTRAINT "hub_activity_events_source_length_check" CHECK (((source IS NULL) OR (char_length(source) <= 40)))
);
ALTER TABLE public."hub_activity_events" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."hub_activity_events" TO anon,authenticated,service_role;

CREATE TABLE public."realtor_profiles" (
id uuid DEFAULT gen_random_uuid() NOT NULL,
user_id uuid,
slug text NOT NULL,
full_name text,
email text,
phone text,
bio text,
headshot_url text,
video_url text,
plan text DEFAULT 'free'::text,
page_data jsonb DEFAULT '{}'::jsonb,
created_at timestamp with time zone DEFAULT now(),
updated_at timestamp with time zone DEFAULT now(),
CONSTRAINT "realtor_profiles_slug_key" UNIQUE (slug),
CONSTRAINT "realtor_profiles_user_id_key" UNIQUE (user_id),
CONSTRAINT "realtor_profiles_pkey" PRIMARY KEY (id),
CONSTRAINT "realtor_profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
ALTER TABLE public."realtor_profiles" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."realtor_profiles" TO anon,authenticated,service_role;

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

CREATE OR REPLACE FUNCTION public.protect_profile_plan()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  jwt_role text;
  effective_plan text;
begin
  jwt_role := coalesce(auth.jwt() ->> 'role', '');

  if tg_op = 'INSERT' then
    -- Browser-created accounts always begin on Free.
    if jwt_role = 'authenticated' then
      new.plan := 'partner';
    end if;

    effective_plan := lower(coalesce(new.plan, 'partner'));

    -- Free cannot create paid customization.
    if effective_plan in ('partner', 'free') then
      if
        coalesce(trim(new.headshot_url), '') <> ''
        or coalesce(trim(new.bio), '') <> ''
        or coalesce(trim(new.website_url), '') <> ''
        or coalesce(trim(new.instagram_url), '') <> ''
        or coalesce(trim(new.facebook_url), '') <> ''
        or coalesce(trim(new.linkedin_url), '') <> ''
        or coalesce(trim(new.welcome_video_url), '') <> ''
        or coalesce(trim(new.app_icon_initials), '') <> ''
      then
        raise exception 'This profile customization requires Core or Pro.';
      end if;

      return new;
    end if;

    -- Core cannot create Pro-only customization.
    if effective_plan in ('pro', 'core') then
      if
        coalesce(trim(new.welcome_video_url), '') <> ''
        or coalesce(trim(new.app_icon_initials), '') <> ''
      then
        raise exception 'Welcome video and custom app icon require Pro.';
      end if;

      return new;
    end if;

    if effective_plan = 'premier' then
      return new;
    end if;

    raise exception 'Unknown Close & Relax plan value.';
  end if;

  if tg_op = 'UPDATE' then
    -- Browser users cannot change their own subscription plan.
    if
      jwt_role = 'authenticated'
      and new.plan is distinct from old.plan
    then
      raise exception 'Subscription plan changes must be handled by Close & Relax billing.';
    end if;

    effective_plan := lower(coalesce(new.plan, 'partner'));

    -- FREE:
    -- Existing Core/Pro data may remain stored after downgrade,
    -- but a Free browser user cannot add, remove, or alter those locked fields.
    if effective_plan in ('partner', 'free') then
      if
        new.headshot_url is distinct from old.headshot_url
        or new.bio is distinct from old.bio
        or new.website_url is distinct from old.website_url
        or new.instagram_url is distinct from old.instagram_url
        or new.facebook_url is distinct from old.facebook_url
        or new.linkedin_url is distinct from old.linkedin_url
        or new.welcome_video_url is distinct from old.welcome_video_url
        or new.app_icon_initials is distinct from old.app_icon_initials
      then
        raise exception 'This profile customization requires Core or Pro.';
      end if;

      return new;
    end if;

    -- CORE:
    -- Existing Pro-only data may remain stored after downgrade,
    -- but Core cannot change the Pro-only fields.
    if effective_plan in ('pro', 'core') then
      if
        new.welcome_video_url is distinct from old.welcome_video_url
        or new.app_icon_initials is distinct from old.app_icon_initials
      then
        raise exception 'Welcome video and custom app icon require Pro.';
      end if;

      return new;
    end if;

    if effective_plan = 'premier' then
      return new;
    end if;

    raise exception 'Unknown Close & Relax plan value.';
  end if;

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

CREATE OR REPLACE FUNCTION public.set_custom_hub_section_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_homeowner_checklist_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_realtor_benefit_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_vendor_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
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

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon,authenticated,service_role;
CREATE POLICY "Owners can view own custom hub sections" ON public."custom_hub_sections" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((profile_id = auth.uid()));
CREATE POLICY "Pro owners can create custom hub sections" ON public."custom_hub_sections" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((profile_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.plan = 'premier'::text))))));
CREATE POLICY "Pro owners can delete custom hub sections" ON public."custom_hub_sections" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((profile_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.plan = 'premier'::text))))));
CREATE POLICY "Pro owners can update custom hub sections" ON public."custom_hub_sections" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((profile_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.plan = 'premier'::text)))))) WITH CHECK (((profile_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.plan = 'premier'::text))))));
CREATE POLICY "Public can view active Pro custom hub sections" ON public."custom_hub_sections" AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (((is_active = true) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = custom_hub_sections.profile_id) AND (p.is_published = true) AND (p.plan = 'premier'::text))))));
CREATE POLICY "Owners can view own checklist items" ON public."homeowner_checklist_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((profile_id = auth.uid()));
CREATE POLICY "Pro owners can create checklist items" ON public."homeowner_checklist_items" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((profile_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.plan = 'premier'::text))))));
CREATE POLICY "Pro owners can delete checklist items" ON public."homeowner_checklist_items" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((profile_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.plan = 'premier'::text))))));
CREATE POLICY "Pro owners can update checklist items" ON public."homeowner_checklist_items" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((profile_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.plan = 'premier'::text)))))) WITH CHECK (((profile_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.plan = 'premier'::text))))));
CREATE POLICY "Public can view active Pro checklist items" ON public."homeowner_checklist_items" AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (((is_active = true) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = homeowner_checklist_items.profile_id) AND (p.is_published = true) AND (p.plan = 'premier'::text))))));
CREATE POLICY "Public can record published hub activity" ON public."hub_activity_events" AS PERMISSIVE FOR INSERT TO "anon","authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = hub_activity_events.profile_id) AND (p.is_published = true)))));
CREATE POLICY "Realtors can view their own hub activity" ON public."hub_activity_events" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((profile_id = auth.uid()));
CREATE POLICY "Public can view published profiles" ON public."profiles" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((is_published = true));
CREATE POLICY "Users can create own profile" ON public."profiles" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((auth.uid() = id));
CREATE POLICY "Users can update own profile" ON public."profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));
CREATE POLICY "Users can view own profile" ON public."profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((auth.uid() = id));
CREATE POLICY "Authenticated members can view eligible realtor benefits" ON public."realtor_benefits" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((is_active = true) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((p.plan = ANY (realtor_benefits.eligible_plans)) OR ((p.plan = 'free'::text) AND ('partner'::text = ANY (realtor_benefits.eligible_plans))) OR ((p.plan = 'core'::text) AND ('pro'::text = ANY (realtor_benefits.eligible_plans)))))))));
CREATE POLICY "Public can view realtor profiles" ON public."realtor_profiles" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Users can create their own profile" ON public."realtor_profiles" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can update their own profile" ON public."realtor_profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Public can view vendors for published profiles" ON public."vendors" AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (((is_active = true) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = vendors.profile_id) AND (p.is_published = true))))));
CREATE POLICY "Users can create their own vendors" ON public."vendors" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((profile_id = auth.uid()) AND (is_default = false)));
CREATE POLICY "Users can delete their own vendors" ON public."vendors" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((profile_id = auth.uid()) AND ((is_default = false) OR COALESCE(vendor_plan_allows_default_control(profile_id), false))));
CREATE POLICY "Users can update their own vendors" ON public."vendors" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((profile_id = auth.uid()) AND ((is_default = false) OR COALESCE(vendor_plan_allows_default_control(profile_id), false)))) WITH CHECK ((profile_id = auth.uid()));
CREATE POLICY "Users can view their own vendors" ON public."vendors" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((profile_id = auth.uid()));

CREATE TRIGGER add_standard_vendor_after_profile_insert AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION handle_new_profile_standard_vendor();
CREATE TRIGGER enforce_vendor_plan_rules_before_delete BEFORE DELETE ON public.vendors FOR EACH ROW EXECUTE FUNCTION enforce_vendor_plan_rules();
CREATE TRIGGER enforce_vendor_plan_rules_before_insert BEFORE INSERT ON public.vendors FOR EACH ROW EXECUTE FUNCTION enforce_vendor_plan_rules();
CREATE TRIGGER enforce_vendor_plan_rules_before_update BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION enforce_vendor_plan_rules();
CREATE TRIGGER protect_profile_plan_before_insert BEFORE INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION protect_profile_plan();
CREATE TRIGGER protect_profile_plan_before_update BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION protect_profile_plan();
CREATE TRIGGER set_custom_hub_section_updated_at BEFORE UPDATE ON public.custom_hub_sections FOR EACH ROW EXECUTE FUNCTION set_custom_hub_section_updated_at();
CREATE TRIGGER set_homeowner_checklist_updated_at BEFORE UPDATE ON public.homeowner_checklist_items FOR EACH ROW EXECUTE FUNCTION set_homeowner_checklist_updated_at();
CREATE TRIGGER set_realtor_benefit_updated_at BEFORE UPDATE ON public.realtor_benefits FOR EACH ROW EXECUTE FUNCTION set_realtor_benefit_updated_at();
CREATE TRIGGER set_vendor_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION set_vendor_updated_at();

