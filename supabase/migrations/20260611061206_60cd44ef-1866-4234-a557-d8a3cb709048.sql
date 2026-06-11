
CREATE OR REPLACE FUNCTION public._tmp_kick_autosave()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, vault, net
AS $$
  SELECT net.http_post(
    url := 'https://lmgsxyzytssddijjxbzc.supabase.co/functions/v1/process-auto-save',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'autosave_cron_secret' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
$$;

SELECT public._tmp_kick_autosave();
-- give pg_net a moment in this same transaction is not necessary; the request is queued.
DROP FUNCTION public._tmp_kick_autosave();
