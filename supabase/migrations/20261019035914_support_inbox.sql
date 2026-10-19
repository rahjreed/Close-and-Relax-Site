-- Local launch preparation only. Existing admin allowlist is reused, never changed.
BEGIN;
CREATE TABLE close_relax_private.support_messages (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 160),
  email text NOT NULL CHECK (length(email) <= 254 AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  message text NOT NULL CHECK (length(btrim(message)) BETWEEN 1 AND 4000),
  requester_hash text NOT NULL CHECK (requester_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_messages_rate_idx ON close_relax_private.support_messages(requester_hash,created_at);
CREATE INDEX support_messages_created_idx ON close_relax_private.support_messages(created_at DESC,id DESC);
ALTER TABLE close_relax_private.support_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON close_relax_private.support_messages FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION close_relax_private.submit_support_message(message jsonb,client_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE request_id uuid := (message->>'request_id')::uuid; existing close_relax_private.support_messages;
BEGIN
  IF client_hash IS NULL OR client_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invalid request.'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('support:'||client_hash,0));
  SELECT * INTO existing FROM close_relax_private.support_messages s WHERE s.id=request_id;
  IF FOUND THEN
    IF existing.requester_hash IS DISTINCT FROM client_hash OR existing.name IS DISTINCT FROM btrim(message->>'name')
      OR existing.email IS DISTINCT FROM btrim(message->>'email') OR existing.message IS DISTINCT FROM btrim(message->>'message')
      THEN RAISE EXCEPTION 'Invalid request.'; END IF;
    RETURN request_id;
  END IF;
  IF (SELECT count(*) FROM close_relax_private.support_messages s WHERE s.requester_hash=client_hash AND s.created_at>now()-interval '1 hour') >= 5
    THEN RAISE EXCEPTION 'Too many requests.' USING ERRCODE='P0429'; END IF;
  INSERT INTO close_relax_private.support_messages(id,name,email,message,requester_hash)
    VALUES(request_id,btrim(message->>'name'),btrim(message->>'email'),btrim(message->>'message'),client_hash);
  RETURN request_id;
END; $fn$;
CREATE FUNCTION public.submit_support_message(message jsonb,client_hash text)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $fn$
  SELECT close_relax_private.submit_support_message(message,client_hash);
$fn$;
REVOKE ALL ON FUNCTION close_relax_private.submit_support_message(jsonb,text),public.submit_support_message(jsonb,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION close_relax_private.submit_support_message(jsonb,text),public.submit_support_message(jsonb,text) TO service_role;

CREATE FUNCTION close_relax_private.list_support_messages(page_offset integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE result jsonb;
BEGIN
  IF NOT close_relax_private.is_platform_admin() THEN RAISE EXCEPTION 'Administrator access required.' USING ERRCODE='42501'; END IF;
  IF page_offset IS NULL OR page_offset < 0 OR page_offset > 1000000 THEN RAISE EXCEPTION 'Invalid page.'; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC,r.id DESC),'[]'::jsonb) INTO result FROM (
    SELECT s.id,s.name,s.email,s.message,s.status,s.created_at FROM close_relax_private.support_messages s
    ORDER BY s.created_at DESC,s.id DESC LIMIT 50 OFFSET page_offset
  ) r;
  RETURN result;
END; $fn$;
CREATE FUNCTION public.list_support_messages(page_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $fn$
  SELECT close_relax_private.list_support_messages(page_offset);
$fn$;

CREATE FUNCTION close_relax_private.update_support_message_status(message_id uuid,new_status text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  IF NOT close_relax_private.is_platform_admin() THEN RAISE EXCEPTION 'Administrator access required.' USING ERRCODE='42501'; END IF;
  IF new_status IS NULL OR new_status NOT IN ('new','in_progress','closed') THEN RAISE EXCEPTION 'Invalid status.'; END IF;
  UPDATE close_relax_private.support_messages SET status=new_status WHERE id=message_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Message unavailable.'; END IF;
  RETURN new_status;
END; $fn$;
CREATE FUNCTION public.update_support_message_status(message_id uuid,new_status text)
RETURNS text LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $fn$
  SELECT close_relax_private.update_support_message_status(message_id,new_status);
$fn$;
REVOKE ALL ON FUNCTION close_relax_private.list_support_messages(integer),public.list_support_messages(integer),close_relax_private.update_support_message_status(uuid,text),public.update_support_message_status(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION close_relax_private.list_support_messages(integer),public.list_support_messages(integer),close_relax_private.update_support_message_status(uuid,text),public.update_support_message_status(uuid,text) TO authenticated;
COMMIT;
