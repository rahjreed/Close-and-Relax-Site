-- Phase 1 independent reminders. Does not modify any existing policy/function/trigger.
BEGIN;
CREATE SCHEMA IF NOT EXISTS close_relax_private;

CREATE TABLE close_relax_private.homeowner_push_subscriptions (
  id uuid PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  hub_origin text NOT NULL,
  endpoint_hash text NOT NULL UNIQUE,
  encrypted_subscription text,
  capability_hash text NOT NULL CHECK(length(capability_hash)=43),
  confirmation_hash text,
  confirmation_expires_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','disabled','invalid','auth_error')),
  timezone text NOT NULL,
  delivery_time time NOT NULL DEFAULT '10:00' CHECK(delivery_time BETWEEN '09:00' AND '19:00'),
  consent_version text NOT NULL,
  consent_at timestamptz NOT NULL DEFAULT now(),
  vapid_key_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE close_relax_private.homeowner_push_reminders (
  subscription_id uuid NOT NULL REFERENCES close_relax_private.homeowner_push_subscriptions(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK(kind IN ('hvac','monthly','seasonal')),
  enabled boolean NOT NULL,
  first_date date,
  interval_days integer,
  next_due_at timestamptz,
  revision integer NOT NULL DEFAULT 1,
  PRIMARY KEY(subscription_id,kind),
  CHECK(kind <> 'hvac' OR NOT enabled OR (first_date IS NOT NULL AND interval_days BETWEEN 7 AND 730))
);
CREATE INDEX homeowner_push_due_idx ON close_relax_private.homeowner_push_reminders(next_due_at) WHERE enabled;
CREATE TABLE close_relax_private.homeowner_push_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES close_relax_private.homeowner_push_subscriptions(id) ON DELETE CASCADE,
  occurrence_key text NOT NULL,
  kinds text[] NOT NULL,
  local_month integer NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','leased','accepted','retry','failed','expired','cancelled')),
  attempt integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  lease_token uuid,
  lease_until timestamptz,
  last_error text,
  accepted_at timestamptz,
  last_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(subscription_id,occurrence_key)
);
CREATE INDEX homeowner_push_work_idx ON close_relax_private.homeowner_push_deliveries(next_attempt_at) WHERE state IN ('pending','retry','leased');

-- Hashed, short-lived abuse buckets; never retain raw network addresses.
CREATE TABLE close_relax_private.homeowner_push_rate_limits (
  bucket_hash text NOT NULL, hour_start timestamptz NOT NULL, hits integer NOT NULL,
  PRIMARY KEY(bucket_hash,hour_start)
);
ALTER TABLE close_relax_private.homeowner_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE close_relax_private.homeowner_push_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE close_relax_private.homeowner_push_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE close_relax_private.homeowner_push_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON close_relax_private.homeowner_push_subscriptions, close_relax_private.homeowner_push_reminders,
  close_relax_private.homeowner_push_deliveries,close_relax_private.homeowner_push_rate_limits FROM PUBLIC,anon,authenticated;

CREATE FUNCTION close_relax_private.push_next_due(kind text, after_date date, first_date date, interval_days integer,
  zone text, at_time time) RETURNS timestamptz LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE target date; difference integer;
BEGIN
  IF kind='hvac' THEN
    target:=first_date;
    IF target<=after_date THEN
      difference:=after_date-target;
      target:=target+((difference/interval_days)+1)*interval_days;
    END IF;
  ELSIF kind='monthly' THEN target:=(date_trunc('month',after_date)+interval '1 month')::date;
  ELSIF kind='seasonal' THEN
    SELECT min(d) INTO target FROM (
      SELECT make_date(y,m,1) AS d FROM generate_series(extract(year FROM after_date)::integer,extract(year FROM after_date)::integer+1) y
      CROSS JOIN (VALUES(3),(6),(9),(12)) months(m)
    ) dates WHERE d>after_date;
  ELSE RAISE EXCEPTION 'unsupported reminder'; END IF;
  RETURN (target+at_time) AT TIME ZONE zone;
END $$;

CREATE FUNCTION public.homeowner_push_rate_limit(bucket text, maximum integer) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n integer;
BEGIN
  IF length(bucket)<>43 OR maximum NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'invalid bucket'; END IF;
  INSERT INTO close_relax_private.homeowner_push_rate_limits VALUES(bucket,date_trunc('hour',now()),1)
    ON CONFLICT(bucket_hash,hour_start) DO UPDATE SET hits=close_relax_private.homeowner_push_rate_limits.hits+1 RETURNING hits INTO n;
  RETURN n<=maximum;
END $$;

CREATE FUNCTION public.homeowner_push_manage(payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s close_relax_private.homeowner_push_subscriptions; p public.profiles; r jsonb;
  act text:=payload->>'action'; identity uuid:=(payload->>'id')::uuid; origin text:=payload->>'origin';
  prefs jsonb:=payload->'preferences'; today date; due timestamptz; affected integer; existing close_relax_private.homeowner_push_reminders;
BEGIN
  -- All calls originate in the service-only Edge Function; capability is still mandatory.
  IF length(payload->>'capability_hash')<>43 THEN RAISE EXCEPTION 'unavailable'; END IF;
  SELECT * INTO s FROM close_relax_private.homeowner_push_subscriptions WHERE id=identity FOR UPDATE;
  IF NOT FOUND AND act='unsubscribe' THEN RETURN jsonb_build_object('status','disabled'); END IF;
  IF FOUND THEN
    IF s.capability_hash IS DISTINCT FROM payload->>'capability_hash' OR s.hub_origin IS DISTINCT FROM origin THEN RAISE EXCEPTION 'unavailable'; END IF;
    IF act='unsubscribe' THEN
      DELETE FROM close_relax_private.homeowner_push_subscriptions WHERE id=identity;
      RETURN jsonb_build_object('status','disabled');
    END IF;
    SELECT * INTO p FROM public.profiles WHERE id=s.profile_id AND is_published=true;
  ELSE
    IF act<>'enroll' THEN RAISE EXCEPTION 'unavailable'; END IF;
    SELECT * INTO p FROM public.profiles WHERE id=(payload->>'profile_id')::uuid AND is_published=true;
  END IF;
  IF p.id IS NULL OR origin IS DISTINCT FROM 'https://'||p.slug||'.closeandrelax.com' THEN RAISE EXCEPTION 'unavailable'; END IF;
  IF act='confirm' THEN
    IF s.status='pending' AND s.confirmation_hash=payload->>'confirmation_hash' AND s.confirmation_expires_at>now() THEN
      UPDATE close_relax_private.homeowner_push_subscriptions SET status='active',confirmation_hash=NULL,confirmation_expires_at=NULL,updated_at=now() WHERE id=identity;
      -- Count the visible welcome against frequency caps as well. Retry confirmations
      -- never add another occurrence after this transition has succeeded.
      INSERT INTO close_relax_private.homeowner_push_deliveries(subscription_id,occurrence_key,kinds,local_month,state,expires_at,last_attempt_at,accepted_at)
      VALUES(identity,'welcome:'||s.confirmation_hash,'{}',extract(month FROM now() AT TIME ZONE s.timezone)::integer,'accepted',now(),now(),now()) ON CONFLICT DO NOTHING;
    ELSIF s.status<>'active' THEN RAISE EXCEPTION 'confirmation expired'; END IF;
  ELSIF act IN ('enroll','replace','preferences') THEN
    IF prefs->>'timezone' IS NULL OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=prefs->>'timezone') OR
      (prefs->>'delivery_time')::time NOT BETWEEN '09:00' AND '19:00' OR jsonb_array_length(prefs->'reminders')<>3 OR
      (SELECT count(DISTINCT value->>'kind') FROM jsonb_array_elements(prefs->'reminders'))<>3 THEN RAISE EXCEPTION 'invalid preferences'; END IF;
    IF act IN ('enroll','replace') THEN
      IF length(payload->>'confirmation_hash')<>43 OR length(payload->>'endpoint_hash')<>43 OR length(payload->>'encrypted_subscription') NOT BETWEEN 20 AND 8192 THEN RAISE EXCEPTION 'invalid subscription'; END IF;
      IF s.id IS NOT NULL AND act='enroll' AND s.status='active' THEN RAISE EXCEPTION 'use replacement'; END IF;
      INSERT INTO close_relax_private.homeowner_push_subscriptions(id,profile_id,hub_origin,endpoint_hash,encrypted_subscription,capability_hash,
        confirmation_hash,confirmation_expires_at,status,timezone,delivery_time,consent_version,vapid_key_id)
      VALUES(identity,p.id,origin,payload->>'endpoint_hash',payload->>'encrypted_subscription',payload->>'capability_hash',
        payload->>'confirmation_hash',now()+interval '10 minutes','pending',prefs->>'timezone',(prefs->>'delivery_time')::time,'home-reminders-v1',payload->>'vapid_key_id')
      ON CONFLICT(id) DO UPDATE SET endpoint_hash=excluded.endpoint_hash,encrypted_subscription=excluded.encrypted_subscription,
        confirmation_hash=excluded.confirmation_hash,confirmation_expires_at=excluded.confirmation_expires_at,status='pending',
        timezone=excluded.timezone,delivery_time=excluded.delivery_time,vapid_key_id=excluded.vapid_key_id,updated_at=now()
      WHERE homeowner_push_subscriptions.capability_hash=excluded.capability_hash
        AND homeowner_push_subscriptions.profile_id=excluded.profile_id AND homeowner_push_subscriptions.hub_origin=excluded.hub_origin;
      GET DIAGNOSTICS affected=ROW_COUNT;
      IF affected<>1 THEN RAISE EXCEPTION 'unavailable'; END IF;
    ELSE
      IF s.id IS NULL THEN RAISE EXCEPTION 'unavailable'; END IF;
      UPDATE close_relax_private.homeowner_push_subscriptions SET timezone=prefs->>'timezone',delivery_time=(prefs->>'delivery_time')::time,updated_at=now() WHERE id=identity;
    END IF;
    today:=(now() AT TIME ZONE (prefs->>'timezone'))::date;
    FOR r IN SELECT value FROM jsonb_array_elements(prefs->'reminders') LOOP
      IF r->>'kind' NOT IN ('hvac','monthly','seasonal') THEN RAISE EXCEPTION 'invalid kind'; END IF;
      SELECT * INTO existing FROM close_relax_private.homeowner_push_reminders WHERE subscription_id=identity AND kind=r->>'kind';
      -- Preserve an unchanged occurrence so saving settings cannot recreate a sent reminder.
      IF existing.subscription_id IS NOT NULL AND existing.enabled=(r->>'enabled')::boolean AND
        existing.first_date IS NOT DISTINCT FROM (r->>'first_date')::date AND existing.interval_days IS NOT DISTINCT FROM (r->>'interval_days')::integer AND
        s.timezone=prefs->>'timezone' AND s.delivery_time=(prefs->>'delivery_time')::time THEN CONTINUE; END IF;
      due:=NULL;
      IF (r->>'enabled')::boolean THEN
        due:=close_relax_private.push_next_due(r->>'kind',today-1,(r->>'first_date')::date,(r->>'interval_days')::integer,prefs->>'timezone',(prefs->>'delivery_time')::time);
        IF due<now() THEN due:=close_relax_private.push_next_due(r->>'kind',today,(r->>'first_date')::date,(r->>'interval_days')::integer,prefs->>'timezone',(prefs->>'delivery_time')::time); END IF;
      END IF;
      INSERT INTO close_relax_private.homeowner_push_reminders(subscription_id,kind,enabled,first_date,interval_days,next_due_at)
      VALUES(identity,r->>'kind',(r->>'enabled')::boolean,(r->>'first_date')::date,(r->>'interval_days')::integer,due)
      ON CONFLICT(subscription_id,kind) DO UPDATE SET enabled=excluded.enabled,first_date=excluded.first_date,interval_days=excluded.interval_days,next_due_at=excluded.next_due_at,
        revision=close_relax_private.homeowner_push_reminders.revision+1;
    END LOOP;
    -- Old pending payloads must not outlive a preference/subscription change.
    UPDATE close_relax_private.homeowner_push_deliveries SET state='cancelled' WHERE subscription_id=identity AND state IN ('pending','retry','leased');
  ELSIF act<>'read' THEN RAISE EXCEPTION 'invalid action'; END IF;
  SELECT * INTO s FROM close_relax_private.homeowner_push_subscriptions WHERE id=identity;
  RETURN jsonb_build_object('status',s.status,'preferences',jsonb_build_object('timezone',s.timezone,'delivery_time',left(s.delivery_time::text,5),
    'reminders',(SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object('kind',kind,'enabled',enabled,'first_date',first_date,'interval_days',interval_days)) ORDER BY kind) FROM close_relax_private.homeowner_push_reminders WHERE subscription_id=identity)));
END $$;

CREATE FUNCTION public.homeowner_push_claim() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s close_relax_private.homeowner_push_subscriptions; r close_relax_private.homeowner_push_reminders;
  today date; kinds text[]; occurrence text; due_at timestamptz; output jsonb:='[]'; d close_relax_private.homeowner_push_deliveries;
BEGIN
  -- One dispatcher may schedule at a time; row leases protect sends across invocations.
  IF NOT pg_try_advisory_xact_lock(684103218) THEN RETURN '[]'::jsonb; END IF;
  DELETE FROM close_relax_private.homeowner_push_rate_limits WHERE hour_start<now()-interval '2 hours';
  DELETE FROM close_relax_private.homeowner_push_subscriptions WHERE (status='pending' AND confirmation_expires_at<now()-interval '1 day') OR
    (status IN ('disabled','invalid') AND updated_at<now()-interval '30 days');
  DELETE FROM close_relax_private.homeowner_push_deliveries WHERE created_at<now()-interval '30 days';
  UPDATE close_relax_private.homeowner_push_subscriptions stored_sub SET status='disabled',encrypted_subscription=NULL,updated_at=now()
    WHERE status IN ('pending','active') AND NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=stored_sub.profile_id AND p.is_published AND stored_sub.hub_origin='https://'||p.slug||'.closeandrelax.com');
  UPDATE close_relax_private.homeowner_push_deliveries stored_delivery SET state='cancelled'
    WHERE state IN ('pending','retry','leased') AND NOT EXISTS(SELECT 1 FROM close_relax_private.homeowner_push_subscriptions stored_sub WHERE stored_sub.id=stored_delivery.subscription_id AND stored_sub.status='active');
  UPDATE close_relax_private.homeowner_push_deliveries SET state='expired' WHERE state IN ('pending','retry','leased') AND expires_at<=now();
  FOR s IN SELECT * FROM close_relax_private.homeowner_push_subscriptions candidate_sub WHERE status='active' AND EXISTS(
    SELECT 1 FROM close_relax_private.homeowner_push_reminders due_rem WHERE due_rem.subscription_id=candidate_sub.id AND due_rem.enabled AND due_rem.next_due_at<=now()) ORDER BY candidate_sub.id LIMIT 200 FOR UPDATE SKIP LOCKED LOOP
    today:=(now() AT TIME ZONE s.timezone)::date; kinds:='{}'; occurrence:=''; due_at:=NULL;
    FOR r IN SELECT * FROM close_relax_private.homeowner_push_reminders WHERE subscription_id=s.id AND enabled AND next_due_at<=now() ORDER BY kind LOOP
      -- Advance every occurrence, including stale ones: no overdue backlog or daily nagging.
      IF r.next_due_at>now()-interval '6 hours' THEN
        kinds:=array_append(kinds,r.kind); occurrence:=occurrence||r.kind||':'||r.revision||':'||extract(epoch FROM r.next_due_at)::text||';';
        due_at:=greatest(due_at,r.next_due_at);
      END IF;
      UPDATE close_relax_private.homeowner_push_reminders SET next_due_at=close_relax_private.push_next_due(r.kind,today,r.first_date,r.interval_days,s.timezone,s.delivery_time) WHERE subscription_id=s.id AND kind=r.kind;
    END LOOP;
    IF cardinality(kinds)>0 AND NOT EXISTS(SELECT 1 FROM close_relax_private.homeowner_push_deliveries WHERE subscription_id=s.id AND
      (state IN ('pending','retry','leased') OR (last_attempt_at AT TIME ZONE s.timezone)::date=today)) AND
      (SELECT count(*) FROM close_relax_private.homeowner_push_deliveries WHERE subscription_id=s.id AND last_attempt_at>now()-interval '7 days')<2 THEN
      INSERT INTO close_relax_private.homeowner_push_deliveries(subscription_id,occurrence_key,kinds,local_month,expires_at)
      VALUES(s.id,occurrence,kinds,extract(month FROM today)::integer,due_at+interval '6 hours') ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  FOR d IN SELECT * FROM close_relax_private.homeowner_push_deliveries WHERE
    (state IN ('pending','retry') AND next_attempt_at<=now() OR state='leased' AND lease_until<now()) AND expires_at>now() AND attempt<5
    ORDER BY next_attempt_at LIMIT 25 FOR UPDATE SKIP LOCKED LOOP
    SELECT * INTO s FROM close_relax_private.homeowner_push_subscriptions WHERE id=d.subscription_id;
    IF (now() AT TIME ZONE s.timezone)::time NOT BETWEEN '09:00' AND '19:00' OR
      EXISTS(SELECT 1 FROM close_relax_private.homeowner_push_deliveries other WHERE other.subscription_id=s.id AND other.id<>d.id
        AND (other.last_attempt_at AT TIME ZONE s.timezone)::date=(now() AT TIME ZONE s.timezone)::date) OR
      (SELECT count(*) FROM close_relax_private.homeowner_push_deliveries other WHERE other.subscription_id=s.id AND other.id<>d.id AND other.last_attempt_at>now()-interval '7 days')>=2 THEN
      UPDATE close_relax_private.homeowner_push_deliveries SET state='expired' WHERE id=d.id;
      CONTINUE;
    END IF;
    UPDATE close_relax_private.homeowner_push_deliveries SET state='leased',attempt=attempt+1,last_attempt_at=now(),lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes' WHERE id=d.id RETURNING * INTO d;
    output:=output||jsonb_build_array(jsonb_build_object('id',d.id,'lease_token',d.lease_token,'attempt',d.attempt,'kinds',d.kinds,'local_month',d.local_month,
      'subscription_id',s.id,'encrypted_subscription',s.encrypted_subscription,'vapid_key_id',s.vapid_key_id));
  END LOOP;
  RETURN output;
END $$;

CREATE FUNCTION public.homeowner_push_finish(delivery_id uuid, lease uuid, outcome text, retry_at timestamptz DEFAULT NULL, error_code text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE d close_relax_private.homeowner_push_deliveries;
BEGIN
  SELECT * INTO d FROM close_relax_private.homeowner_push_deliveries WHERE id=delivery_id AND state='leased' AND lease_token=lease FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF outcome IN ('invalid','auth_error') THEN
    UPDATE close_relax_private.homeowner_push_subscriptions SET status=outcome,encrypted_subscription=CASE WHEN outcome='invalid' THEN NULL ELSE encrypted_subscription END,updated_at=now() WHERE id=d.subscription_id;
    UPDATE close_relax_private.homeowner_push_deliveries SET state='cancelled' WHERE subscription_id=d.subscription_id AND state IN ('pending','retry');
  END IF;
  UPDATE close_relax_private.homeowner_push_deliveries SET state=CASE WHEN outcome='accepted' THEN 'accepted' WHEN outcome='retry' AND retry_at<expires_at THEN 'retry' ELSE 'failed' END,
    next_attempt_at=coalesce(retry_at,now()),accepted_at=CASE WHEN outcome='accepted' THEN now() ELSE NULL END,
    lease_token=NULL,lease_until=NULL,last_error=left(error_code,40) WHERE id=d.id;
END $$;

-- Worker rechecks this immediately before each network send (publication/consent can change after claim).
CREATE FUNCTION public.homeowner_push_send_allowed(delivery_id uuid, lease uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS(SELECT 1 FROM close_relax_private.homeowner_push_deliveries d
    JOIN close_relax_private.homeowner_push_subscriptions s ON s.id=d.subscription_id JOIN public.profiles p ON p.id=s.profile_id
    WHERE d.id=delivery_id AND d.lease_token=lease AND d.state='leased' AND d.lease_until>now() AND d.expires_at>now()
      AND s.status='active' AND p.is_published AND s.hub_origin='https://'||p.slug||'.closeandrelax.com')
$$;
REVOKE ALL ON FUNCTION close_relax_private.push_next_due(text,date,date,integer,text,time) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.homeowner_push_manage(jsonb),public.homeowner_push_rate_limit(text,integer),public.homeowner_push_claim(),
  public.homeowner_push_finish(uuid,uuid,text,timestamptz,text),public.homeowner_push_send_allowed(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.homeowner_push_manage(jsonb),public.homeowner_push_rate_limit(text,integer),public.homeowner_push_claim(),
  public.homeowner_push_finish(uuid,uuid,text,timestamptz,text),public.homeowner_push_send_allowed(uuid,uuid) TO service_role;
COMMIT;
