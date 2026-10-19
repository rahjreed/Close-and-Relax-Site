-- SEPARATE OPERATOR STEP ONLY AFTER migration, secrets, function deployment and checks.
-- Never execute automatically from the application or the migration.
-- First create Vault secrets securely in the Dashboard (do not put values in this file):
-- homeowner_push_project_url = production Supabase URL
-- homeowner_push_cron_secret = same value as Edge WEB_PUSH_CRON_SECRET
BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='homeowner_push_project_url' AND decrypted_secret='https://hphcejnvxyccmwmofdqc.supabase.co') OR
    NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='homeowner_push_cron_secret' AND length(decrypted_secret)>=32) THEN
    RAISE EXCEPTION 'Configure and verify the two push Vault secrets first';
  END IF;
  IF EXISTS(SELECT 1 FROM cron.job WHERE jobname='homeowner-push-dispatch') THEN
    RAISE EXCEPTION 'Dispatcher already scheduled; inspect existing job instead of duplicating it';
  END IF;
END $$;
SELECT cron.schedule('homeowner-push-dispatch','*/15 * * * *',$job$
  SELECT net.http_post(
    url:=(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='homeowner_push_project_url')||'/functions/v1/homeowner-push-dispatch',
    headers:=jsonb_build_object('Content-Type','application/json','x-push-cron-secret',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='homeowner_push_cron_secret')),
    body:='{}'::jsonb,
    timeout_milliseconds:=60000
  );
$job$);
COMMIT;
