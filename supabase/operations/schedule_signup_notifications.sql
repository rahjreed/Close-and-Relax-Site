-- REVIEWED OPERATOR STEP ONLY. Not a migration; do not run without rollout approval.
-- Requires separately approved pg_cron + pg_net and the two named Vault secrets.
-- Does not enable extensions, set secrets or schedule any Home Reminders work.
DO $check$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron')
    OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_net') THEN
    RAISE EXCEPTION 'Approve and enable the required scheduler extensions first.';
  END IF;
  IF (SELECT count(*) FROM vault.decrypted_secrets WHERE name='signup_notifications_project_url')<>1
    OR (SELECT count(*) FROM vault.decrypted_secrets WHERE name='signup_notification_worker_secret')<>1 THEN
    RAISE EXCEPTION 'Exactly one of each signup worker Vault secret is required.';
  END IF;
  IF (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='signup_notifications_project_url')
    IS DISTINCT FROM 'https://hphcejnvxyccmwmofdqc.supabase.co' THEN
    RAISE EXCEPTION 'Unexpected project URL.';
  END IF;
  IF (SELECT length(decrypted_secret) FROM vault.decrypted_secrets WHERE name='signup_notification_worker_secret')<32 THEN
    RAISE EXCEPTION 'Worker secret must have at least 32 characters.';
  END IF;
END;
$check$;

SELECT cron.schedule('close-relax-signup-notifications','*/5 * * * *',$job$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='signup_notifications_project_url') || '/functions/v1/signup-notifications',
    headers := jsonb_build_object('Content-Type','application/json','Authorization',
      'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='signup_notification_worker_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$job$);
