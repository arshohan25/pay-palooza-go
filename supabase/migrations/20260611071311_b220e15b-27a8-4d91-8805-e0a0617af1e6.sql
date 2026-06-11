-- ============================================================
-- 1. cron_invocation_log
-- ============================================================
CREATE TABLE public.cron_invocation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  triggered_by text NOT NULL,
  auth_method text NOT NULL,
  status_code int NOT NULL,
  processed int NOT NULL DEFAULT 0,
  skipped int NOT NULL DEFAULT 0,
  settled int NOT NULL DEFAULT 0,
  missed int NOT NULL DEFAULT 0,
  dedup int NOT NULL DEFAULT 0,
  schedule_count int NOT NULL DEFAULT 0,
  duration_ms int,
  request_id text,
  error_code text,
  error_message text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cron_invocation_log TO authenticated;
GRANT ALL ON public.cron_invocation_log TO service_role;

ALTER TABLE public.cron_invocation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read cron invocation logs"
ON public.cron_invocation_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_cron_log_fn_time ON public.cron_invocation_log(function_name, created_at DESC);
CREATE INDEX idx_cron_log_status_time ON public.cron_invocation_log(status_code, created_at DESC);

-- ============================================================
-- 2. cron_alert_state
-- ============================================================
CREATE TABLE public.cron_alert_state (
  schedule_id uuid PRIMARY KEY,
  last_alerted_at timestamptz NOT NULL DEFAULT now(),
  alert_count int NOT NULL DEFAULT 1
);

GRANT SELECT ON public.cron_alert_state TO authenticated;
GRANT ALL ON public.cron_alert_state TO service_role;

ALTER TABLE public.cron_alert_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read cron alert state"
ON public.cron_alert_state
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 3. log_cron_invocation (service-role only)
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_cron_invocation(
  p_function text,
  p_triggered_by text,
  p_auth_method text,
  p_status_code int,
  p_processed int DEFAULT 0,
  p_skipped int DEFAULT 0,
  p_settled int DEFAULT 0,
  p_missed int DEFAULT 0,
  p_dedup int DEFAULT 0,
  p_schedule_count int DEFAULT 0,
  p_duration_ms int DEFAULT NULL,
  p_request_id text DEFAULT NULL,
  p_error_code text DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_meta jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.cron_invocation_log (
    function_name, triggered_by, auth_method, status_code,
    processed, skipped, settled, missed, dedup, schedule_count,
    duration_ms, request_id, error_code, error_message, meta
  ) VALUES (
    p_function, p_triggered_by, p_auth_method, p_status_code,
    p_processed, p_skipped, p_settled, p_missed, p_dedup, p_schedule_count,
    p_duration_ms, p_request_id, p_error_code, p_error_message, p_meta
  )
  RETURNING id;
$$;

REVOKE ALL ON FUNCTION public.log_cron_invocation(text,text,text,int,int,int,int,int,int,int,int,text,text,text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_cron_invocation(text,text,text,int,int,int,int,int,int,int,int,text,text,text,jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.log_cron_invocation(text,text,text,int,int,int,int,int,int,int,int,text,text,text,jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.log_cron_invocation(text,text,text,int,int,int,int,int,int,int,int,text,text,text,jsonb) TO service_role;

-- ============================================================
-- 4. get_cron_health_snapshot (admin-only)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_cron_health_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  WITH
  fn_stats_24h AS (
    SELECT
      count(*) FILTER (WHERE status_code = 200)::int AS success_24h,
      count(*) FILTER (WHERE status_code = 401)::int AS err_401_24h,
      count(*) FILTER (WHERE status_code >= 500)::int AS err_5xx_24h,
      max(created_at) FILTER (WHERE status_code = 200) AS last_success_at,
      max(created_at) FILTER (WHERE status_code >= 400) AS last_error_at
    FROM public.cron_invocation_log
    WHERE function_name = 'process-auto-save'
      AND created_at >= now() - interval '24 hours'
  ),
  fn_stats_7d AS (
    SELECT
      count(*) FILTER (WHERE status_code = 200)::int AS success_7d,
      count(*) FILTER (WHERE status_code = 401)::int AS err_401_7d,
      count(*) FILTER (WHERE status_code >= 500)::int AS err_5xx_7d
    FROM public.cron_invocation_log
    WHERE function_name = 'process-auto-save'
      AND created_at >= now() - interval '7 days'
  ),
  hourly AS (
    SELECT
      to_char(date_trunc('hour', created_at), 'YYYY-MM-DD"T"HH24:00:00"Z"') AS hour,
      count(*) FILTER (WHERE status_code = 200)::int AS ok,
      count(*) FILTER (WHERE status_code >= 400)::int AS err
    FROM public.cron_invocation_log
    WHERE function_name = 'process-auto-save'
      AND created_at >= now() - interval '24 hours'
    GROUP BY 1
    ORDER BY 1
  ),
  schedule_data AS (
    SELECT
      s.id, s.user_id, s.frequency, s.amount, s.next_run_at, s.last_run_at,
      s.is_active, s.settled, s.total_paid, s.total_installments,
      s.missed_count,
      p.phone, p.name,
      CASE
        WHEN s.next_run_at IS NULL THEN NULL
        ELSE EXTRACT(EPOCH FROM (now() - s.next_run_at)) / 3600.0
      END AS hours_overdue,
      (
        s.is_active = true AND COALESCE(s.settled, false) = false
        AND s.next_run_at < now() - interval '24 hours'
      ) AS is_stalled
    FROM public.savings_auto_save s
    LEFT JOIN public.profiles p ON p.user_id = s.user_id
  ),
  last_log AS (
    SELECT DISTINCT ON (schedule_id) schedule_id, outcome, reason, created_at
    FROM public.dps_run_log
    ORDER BY schedule_id, created_at DESC
  )
  SELECT jsonb_build_object(
    'generated_at', now(),
    'stats_24h', (SELECT to_jsonb(fn_stats_24h) FROM fn_stats_24h),
    'stats_7d', (SELECT to_jsonb(fn_stats_7d) FROM fn_stats_7d),
    'hourly', COALESCE((SELECT jsonb_agg(to_jsonb(hourly)) FROM hourly), '[]'::jsonb),
    'stalled_count', (SELECT count(*) FROM schedule_data WHERE is_stalled),
    'schedules', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id,
        'user_id', s.user_id,
        'phone', s.phone,
        'name', s.name,
        'frequency', s.frequency,
        'amount', s.amount,
        'next_run_at', s.next_run_at,
        'last_run_at', s.last_run_at,
        'is_active', s.is_active,
        'settled', s.settled,
        'total_paid', s.total_paid,
        'total_installments', s.total_installments,
        'missed_count', s.missed_count,
        'hours_overdue', s.hours_overdue,
        'is_stalled', s.is_stalled,
        'last_outcome', l.outcome,
        'last_outcome_at', l.created_at
      ))
      FROM schedule_data s
      LEFT JOIN last_log l ON l.schedule_id = s.id
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cron_health_snapshot() TO authenticated;

-- ============================================================
-- 5. Cron jobs: auto-retry on 401/5xx + 6-hourly stall alert
-- ============================================================
DO $$
DECLARE
  v_secret  text;
  v_url     text := 'https://lmgsxyzytssddijjxbzc.supabase.co/functions/v1/process-auto-save';
  v_stall_url text := 'https://lmgsxyzytssddijjxbzc.supabase.co/functions/v1/cron-stall-alert';
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'autosave_cron_secret'
  LIMIT 1;

  IF v_secret IS NULL OR length(v_secret) < 16 THEN
    RAISE EXCEPTION 'autosave_cron_secret missing from vault';
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'phase4-process-auto-save-retry') THEN
    PERFORM cron.unschedule('phase4-process-auto-save-retry');
  END IF;

  PERFORM cron.schedule(
    'phase4-process-auto-save-retry',
    '*/5 * * * *',
    format($f$
      DO $body$
      DECLARE
        v_last_status int;
        v_recent_success boolean;
        v_retries_last_hour int;
      BEGIN
        SELECT status_code INTO v_last_status
        FROM public.cron_invocation_log
        WHERE function_name = 'process-auto-save'
        ORDER BY created_at DESC
        LIMIT 1;

        SELECT EXISTS (
          SELECT 1 FROM public.cron_invocation_log
          WHERE function_name = 'process-auto-save'
            AND status_code = 200
            AND created_at > now() - interval '20 minutes'
        ) INTO v_recent_success;

        SELECT count(*) INTO v_retries_last_hour
        FROM public.cron_invocation_log
        WHERE function_name = 'process-auto-save'
          AND triggered_by = 'retry'
          AND created_at > now() - interval '1 hour';

        IF v_last_status IS NOT NULL
           AND (v_last_status = 401 OR v_last_status >= 500)
           AND NOT v_recent_success
           AND v_retries_last_hour < 3 THEN
          PERFORM net.http_post(
            url := %L,
            headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', %L),
            body := jsonb_build_object('retry', true)
          );
        END IF;
      END
      $body$;
    $f$, v_url, v_secret)
  );

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'phase4-cron-stall-alert') THEN
    PERFORM cron.unschedule('phase4-cron-stall-alert');
  END IF;

  PERFORM cron.schedule(
    'phase4-cron-stall-alert',
    '0 */6 * * *',
    format($f$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', %L),
        body := jsonb_build_object('source','cron')
      );
    $f$, v_stall_url, v_secret)
  );
END $$;