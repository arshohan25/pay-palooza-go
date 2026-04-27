-- Track merchant login attempts for ad-hoc rate limiting
CREATE TABLE public.merchant_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  ip text,
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_merchant_login_attempts_phone_created
  ON public.merchant_login_attempts (phone, created_at DESC);

CREATE INDEX idx_merchant_login_attempts_created
  ON public.merchant_login_attempts (created_at);

-- Enable RLS with NO policies — only service role (edge function) may access
ALTER TABLE public.merchant_login_attempts ENABLE ROW LEVEL SECURITY;

-- Helper: compute lockout state for a phone
-- Threshold: 5 failed attempts in last 15 minutes -> 15-minute lockout
CREATE OR REPLACE FUNCTION public.check_merchant_login_lockout(p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz := now() - interval '15 minutes';
  v_max_attempts constant int := 5;
  v_failed_count int;
  v_oldest_in_window timestamptz;
  v_unlock_at timestamptz;
  v_retry_seconds int;
BEGIN
  SELECT count(*), min(created_at)
    INTO v_failed_count, v_oldest_in_window
  FROM public.merchant_login_attempts
  WHERE phone = p_phone
    AND success = false
    AND created_at >= v_window_start;

  IF v_failed_count >= v_max_attempts THEN
    -- Lockout window ends 15 min after the oldest failure that constitutes the lockout
    v_unlock_at := v_oldest_in_window + interval '15 minutes';
    v_retry_seconds := GREATEST(0, EXTRACT(EPOCH FROM (v_unlock_at - now()))::int);
    RETURN jsonb_build_object(
      'locked', true,
      'attempts_remaining', 0,
      'retry_after_seconds', v_retry_seconds
    );
  END IF;

  RETURN jsonb_build_object(
    'locked', false,
    'attempts_remaining', v_max_attempts - v_failed_count,
    'retry_after_seconds', 0
  );
END;
$$;

-- Purge old rows (called opportunistically by the edge function)
CREATE OR REPLACE FUNCTION public.purge_old_merchant_login_attempts()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.merchant_login_attempts
  WHERE created_at < now() - interval '24 hours';
$$;