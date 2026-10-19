-- Local only. No email, network call, extension, scheduler, secret or backfill send.
-- Depends on the private schema and owner-only profile bootstrap migration.
BEGIN;
CREATE TABLE close_relax_private.realtor_signup_notifications (
  profile_id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('ignored','pending','sending','accepted','failed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  available_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 8),
  first_attempt_at timestamptz,
  lease_id uuid,
  lease_until timestamptz,
  email_payload jsonb,
  provider_message_id text,
  accepted_at timestamptz,
  error_code text CHECK (error_code IN ('transient','rejected','exhausted','retry_window_elapsed','account_unavailable'))
);
CREATE INDEX realtor_signup_notifications_ready_idx ON close_relax_private.realtor_signup_notifications(status,available_at);
ALTER TABLE close_relax_private.realtor_signup_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON close_relax_private.realtor_signup_notifications FROM PUBLIC,anon,authenticated,service_role;

-- Minimal UUID tombstones: never notify for a profile which already exists at rollout.
-- No FK cascade: recreating a profile for the same Auth identity must not notify twice.
INSERT INTO close_relax_private.realtor_signup_notifications(profile_id,status)
SELECT id,'ignored' FROM public.profiles;

CREATE FUNCTION close_relax_private.enqueue_realtor_signup(target_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $fn$
  INSERT INTO close_relax_private.realtor_signup_notifications(profile_id)
  SELECT p.id FROM public.profiles p JOIN auth.users u ON u.id=p.id
  WHERE p.id=target_id AND u.email_confirmed_at IS NOT NULL AND u.email IS NOT NULL
    AND u.deleted_at IS NULL AND NOT coalesce(u.is_anonymous,false)
  ON CONFLICT(profile_id) DO NOTHING;
$fn$;
REVOKE ALL ON FUNCTION close_relax_private.enqueue_realtor_signup(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION close_relax_private.queue_realtor_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  PERFORM close_relax_private.enqueue_realtor_signup(NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- No raw exception or identity in logs; the worker reconciles missing outbox rows.
  RAISE WARNING 'Realtor signup notification enqueue failed; reconciliation required.';
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION close_relax_private.queue_realtor_signup() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER queue_realtor_signup_notification AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION close_relax_private.queue_realtor_signup();

CREATE FUNCTION close_relax_private.claim_realtor_signup_notifications(delivery_from text,delivery_to text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE target uuid; job close_relax_private.realtor_signup_notifications; result jsonb := '[]'; payload jsonb;
BEGIN
  IF delivery_from IS NULL OR delivery_to IS NULL OR length(delivery_from)>254 OR length(delivery_to)>254
    OR delivery_from !~ '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$'
    OR delivery_to !~ '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid notification configuration.';
  END IF;
  -- Repair an enqueue failure, never overwrite ignored/sent/failed tombstones.
  FOR target IN SELECT p.id FROM public.profiles p JOIN auth.users u ON u.id=p.id
    WHERE u.email_confirmed_at IS NOT NULL AND u.email IS NOT NULL AND u.deleted_at IS NULL
      AND NOT coalesce(u.is_anonymous,false)
      AND NOT EXISTS (SELECT 1 FROM close_relax_private.realtor_signup_notifications n WHERE n.profile_id=p.id)
    ORDER BY p.created_at,p.id LIMIT 100
  LOOP PERFORM close_relax_private.enqueue_realtor_signup(target); END LOOP;

  UPDATE close_relax_private.realtor_signup_notifications n SET status='failed',lease_id=NULL,lease_until=NULL,
    error_code=CASE WHEN attempts>=8 THEN 'exhausted' ELSE 'retry_window_elapsed' END
  WHERE status IN ('pending','sending') AND (lease_until IS NULL OR lease_until<=now())
    AND (attempts>=8 OR first_attempt_at<=now()-interval '23 hours');

  FOR job IN SELECT * FROM close_relax_private.realtor_signup_notifications n
    WHERE n.status IN ('pending','sending') AND n.available_at<=now()
      AND (n.lease_until IS NULL OR n.lease_until<=now())
    ORDER BY n.created_at,n.profile_id LIMIT 5 FOR UPDATE SKIP LOCKED
  LOOP
    -- Deleted/anonymous/unconfirmed identities never leave the application in email.
    IF NOT EXISTS (SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id
      WHERE p.id=job.profile_id AND u.email_confirmed_at IS NOT NULL AND u.email IS NOT NULL
        AND u.deleted_at IS NULL AND NOT coalesce(u.is_anonymous,false)) THEN
      UPDATE close_relax_private.realtor_signup_notifications SET status='cancelled',email_payload=NULL,
        lease_id=NULL,lease_until=NULL,error_code='account_unavailable' WHERE profile_id=job.profile_id;
      CONTINUE;
    END IF;
    payload := job.email_payload;
    IF payload IS NULL THEN
      SELECT jsonb_build_object('from',delivery_from,'to',jsonb_build_array(delivery_to),
        'subject','New Close & Relax Realtor profile',
        'text',concat('A confirmed Realtor created a Close & Relax profile.',E'\n',
          'Auth signup time (UTC): ',to_char(u.created_at AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'),E'\n',
          'Profile created (UTC): ',to_char(p.created_at AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'),E'\n',
          'Realtor: ',left(regexp_replace(coalesce(p.full_name,''),'[[:cntrl:]]',' ','g'),160),E'\n',
          'Account email: ',left(regexp_replace(u.email,'[[:cntrl:]]',' ','g'),254),E'\n',
          'Profile ID: ',p.id,E'\n','Internal plan: ',left(coalesce(p.plan,'partner'),40),E'\n',
          'Published: ',p.is_published,E'\n','Review in the authenticated Close & Relax dashboard.'))
      INTO payload FROM public.profiles p JOIN auth.users u ON u.id=p.id WHERE p.id=job.profile_id;
    END IF;
    UPDATE close_relax_private.realtor_signup_notifications SET status='sending',attempts=attempts+1,
      first_attempt_at=coalesce(first_attempt_at,now()),lease_id=gen_random_uuid(),lease_until=now()+interval '5 minutes',
      email_payload=payload WHERE profile_id=job.profile_id RETURNING * INTO job;
    result := result || jsonb_build_array(jsonb_build_object('profile_id',job.profile_id,'lease_id',job.lease_id,
      'first_attempt_at',job.first_attempt_at,'payload',job.email_payload));
  END LOOP;
  RETURN result;
END;
$fn$;

CREATE FUNCTION close_relax_private.finish_realtor_signup_notification(target_id uuid,claim_id uuid,outcome text,message_id text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE job close_relax_private.realtor_signup_notifications;
BEGIN
  IF outcome IS NULL OR outcome NOT IN ('accepted','retry','rejected') THEN RAISE EXCEPTION 'Invalid outcome.'; END IF;
  IF outcome='accepted' AND (message_id IS NULL OR message_id !~ '^[A-Za-z0-9_-]{1,120}$') THEN RAISE EXCEPTION 'Invalid receipt.'; END IF;
  SELECT * INTO job FROM close_relax_private.realtor_signup_notifications WHERE profile_id=target_id FOR UPDATE;
  IF NOT FOUND OR job.status<>'sending' OR job.lease_id IS DISTINCT FROM claim_id OR job.lease_until<=now() THEN RETURN false; END IF;
  UPDATE close_relax_private.realtor_signup_notifications SET
    status=CASE WHEN outcome='accepted' THEN 'accepted' WHEN outcome='rejected' OR attempts>=8 THEN 'failed' ELSE 'pending' END,
    available_at=now()+make_interval(secs=>least(3600,60*power(2,attempts)::integer)),
    lease_id=NULL,lease_until=NULL,
    provider_message_id=CASE WHEN outcome='accepted' THEN message_id ELSE NULL END,
    accepted_at=CASE WHEN outcome='accepted' THEN now() ELSE NULL END,
    email_payload=CASE WHEN outcome='accepted' THEN NULL ELSE email_payload END,
    error_code=CASE WHEN outcome='accepted' THEN NULL WHEN outcome='rejected' THEN 'rejected'
      WHEN attempts>=8 THEN 'exhausted' ELSE 'transient' END
    WHERE profile_id=target_id;
  RETURN true;
END;
$fn$;

CREATE FUNCTION public.claim_realtor_signup_notifications(delivery_from text,delivery_to text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $fn$
SELECT close_relax_private.claim_realtor_signup_notifications(delivery_from,delivery_to); $fn$;
CREATE FUNCTION public.finish_realtor_signup_notification(target_id uuid,claim_id uuid,outcome text,message_id text DEFAULT NULL)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $fn$
SELECT close_relax_private.finish_realtor_signup_notification(target_id,claim_id,outcome,message_id); $fn$;
REVOKE ALL ON FUNCTION close_relax_private.claim_realtor_signup_notifications(text,text),public.claim_realtor_signup_notifications(text,text),
  close_relax_private.finish_realtor_signup_notification(uuid,uuid,text,text),public.finish_realtor_signup_notification(uuid,uuid,text,text)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION close_relax_private.claim_realtor_signup_notifications(text,text),public.claim_realtor_signup_notifications(text,text),
  close_relax_private.finish_realtor_signup_notification(uuid,uuid,text,text),public.finish_realtor_signup_notification(uuid,uuid,text,text)
  TO service_role;
COMMIT;
