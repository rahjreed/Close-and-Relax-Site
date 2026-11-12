-- STAGING ONLY. Inspect the staging schema/policies before applying. No production
-- rollout is authorized. Existing manually assigned tiers require an audit.
create table public.billing_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  customer_id text unique,
  subscription_id text unique,
  status text not null default 'none',
  price_id text,
  has_subscribed boolean not null default false,
  cancel_at_period_end boolean not null default false,
  paid_tier text not null default 'partner' check (paid_tier in ('partner','pro','premier')),
  paid_through timestamptz,
  risk_hold boolean not null default false,
  checkout_attempt jsonb,
  lock_token uuid,
  lock_until timestamptz,
  updated_at timestamptz not null default now()
);
create table public.billing_events (
  event_id text primary key,
  user_id uuid not null references public.billing_accounts(user_id) on delete cascade,
  processed_at timestamptz not null default now()
);
alter table public.billing_accounts enable row level security;
alter table public.billing_events enable row level security;
revoke all on public.billing_accounts, public.billing_events from public, anon, authenticated;
grant all on public.billing_accounts, public.billing_events to service_role;
-- No client policies: billing summaries are returned by the authenticated server.

create function public.billing_acquire(account_user uuid, lease_token uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare account_row public.billing_accounts;
begin
  insert into public.billing_accounts(user_id) values(account_user) on conflict do nothing;
  update public.billing_accounts set lock_token=lease_token, lock_until=clock_timestamp()+interval '2 minutes'
    where user_id=account_user and (lock_until is null or lock_until < clock_timestamp())
    returning * into account_row;
  if not found then return null; end if;
  return to_jsonb(account_row);
end $$;

create function public.billing_release(account_user uuid, lease_token uuid)
returns void language sql security invoker set search_path = '' as $$
  update public.billing_accounts set lock_token=null,lock_until=null
    where user_id=account_user and lock_token=lease_token;
$$;

create function public.billing_save(account_user uuid, lease_token uuid, changes jsonb, stripe_event text default null)
returns void language plpgsql security invoker set search_path = '' as $$
declare account_row public.billing_accounts; tier text;
begin
  select * into account_row from public.billing_accounts where user_id=account_user for update;
  if account_row.lock_token is distinct from lease_token or account_row.lock_until < clock_timestamp() then
    raise exception 'Billing lease lost';
  end if;
  if stripe_event is not null and exists(select 1 from public.billing_events where event_id=stripe_event) then return; end if;
  update public.billing_accounts set
    customer_id=case when changes ? 'customer_id' then changes->>'customer_id' else customer_id end,
    subscription_id=case when changes ? 'subscription_id' then changes->>'subscription_id' else subscription_id end,
    status=coalesce(changes->>'status', status),
    price_id=case when changes ? 'price_id' then changes->>'price_id' else price_id end,
    has_subscribed=has_subscribed or coalesce((changes->>'has_subscribed')::boolean,false),
    cancel_at_period_end=coalesce((changes->>'cancel_at_period_end')::boolean,cancel_at_period_end),
    paid_tier=coalesce(changes->>'paid_tier',paid_tier),
    paid_through=case when changes ? 'paid_through' then (changes->>'paid_through')::timestamptz else paid_through end,
    risk_hold=coalesce((changes->>'risk_hold')::boolean,risk_hold),
    checkout_attempt=case when changes ? 'checkout_attempt' then changes->'checkout_attempt' else checkout_attempt end,
    updated_at=now()
    where user_id=account_user returning * into account_row;
  tier := case when not account_row.risk_hold and account_row.paid_through > now() then account_row.paid_tier else 'partner' end;
  update public.profiles set plan=(jsonb_populate_record(null::public.profiles,jsonb_build_object('plan',tier))).plan
    where id=account_user;
  if stripe_event is not null then insert into public.billing_events(event_id,user_id) values(stripe_event,account_user); end if;
end $$;

-- Guard every client write, regardless of permissive pre-existing profile RLS.
-- All INSERTs start Free, including rows created by an auth metadata trigger.
create function public.guard_billing_plan()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then NEW.plan := 'partner';
  elsif NEW.plan is distinct from OLD.plan and current_user not in ('postgres','service_role','supabase_admin') then
    raise exception 'Subscription plan is managed by billing' using errcode='42501';
  end if;
  return NEW;
end $$;
create trigger zz_guard_billing_plan before insert or update on public.profiles
  for each row execute function public.guard_billing_plan();

-- Expire paid access even if Stripe is down or no subsequent webhook arrives.
-- Existing feature permission checks that read profiles.plan keep working.
create function public.billing_expire()
returns void language sql security invoker set search_path = '' as $$
  update public.profiles p set plan='partner' from public.billing_accounts b
    where p.id=b.user_id and p.plan::text <> 'partner'
    and (b.paid_through is null or b.paid_through <= now() or b.risk_hold);
$$;
revoke all on function public.billing_acquire(uuid,uuid), public.billing_release(uuid,uuid),
  public.billing_save(uuid,uuid,jsonb,text), public.billing_expire(), public.guard_billing_plan() from public, anon, authenticated;
grant execute on function public.billing_acquire(uuid,uuid), public.billing_release(uuid,uuid),
  public.billing_save(uuid,uuid,jsonb,text), public.billing_expire() to service_role;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('close-relax-expire-billing', '* * * * *', 'select public.billing_expire()');
