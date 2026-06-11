
-- Create a random cron secret in vault (idempotent)
DO $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM vault.secrets WHERE name = 'autosave_cron_secret') INTO v_exists;
  IF NOT v_exists THEN
    PERFORM vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'autosave_cron_secret',
      'Cron auth secret for process-auto-save and dps-reminder'
    );
  END IF;
END $$;

-- RPC to fetch the secret. SECURITY DEFINER. Only service_role can execute.
CREATE OR REPLACE FUNCTION public.get_autosave_cron_secret()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'autosave_cron_secret' LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_autosave_cron_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_autosave_cron_secret() TO service_role;
