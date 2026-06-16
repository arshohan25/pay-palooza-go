
-- 1. Activity logs table
CREATE TABLE public.user_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id text,
  event_type text NOT NULL, -- 'tap' | 'screen_view' | 'qr' | 'transaction' | 'auth' | 'custom'
  event_name text NOT NULL,
  route text,
  target text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  device_fingerprint text,
  user_agent text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.user_activity_logs TO authenticated;
GRANT ALL ON public.user_activity_logs TO service_role;

ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert own activity"
  ON public.user_activity_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admins view all activity"
  ON public.user_activity_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_user_activity_logs_user_created
  ON public.user_activity_logs (user_id, created_at DESC);
CREATE INDEX idx_user_activity_logs_type_created
  ON public.user_activity_logs (event_type, created_at DESC);
CREATE INDEX idx_user_activity_logs_created
  ON public.user_activity_logs (created_at DESC);

-- 2. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_activity_logs;
ALTER TABLE public.user_activity_logs REPLICA IDENTITY FULL;

-- 3. Bulk insert RPC (lets client batch-insert + server stamps IP)
CREATE OR REPLACE FUNCTION public.log_user_activity(_events jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _ip text := COALESCE(
    NULLIF(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1), ''),
    current_setting('request.headers', true)::json->>'cf-connecting-ip'
  );
  _ua text := current_setting('request.headers', true)::json->>'user-agent';
  _count integer := 0;
BEGIN
  IF _uid IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO public.user_activity_logs (
    user_id, session_id, event_type, event_name, route, target, metadata,
    device_fingerprint, user_agent, ip_address, created_at
  )
  SELECT
    _uid,
    e->>'session_id',
    COALESCE(e->>'event_type', 'custom'),
    COALESCE(e->>'event_name', 'unknown'),
    e->>'route',
    e->>'target',
    COALESCE(e->'metadata', '{}'::jsonb),
    e->>'device_fingerprint',
    _ua,
    _ip,
    COALESCE((e->>'created_at')::timestamptz, now())
  FROM jsonb_array_elements(_events) e;

  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_user_activity(jsonb) TO authenticated;

-- 4. Auto-purge older than 90 days (daily 03:00 UTC)
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule(
  'purge-user-activity-logs',
  '0 3 * * *',
  $$ DELETE FROM public.user_activity_logs WHERE created_at < now() - interval '90 days' $$
);
