-- Enable pgcrypto for hashed PIN storage (safe if already enabled)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. Agent temporary PIN issuance history
-- ============================================================
CREATE TABLE public.agent_temp_pin_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_user_id uuid NOT NULL,
  pin_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  superseded_at timestamptz,
  issued_by uuid,
  issued_via text NOT NULL DEFAULT 'create' CHECK (issued_via IN ('create','resend','admin_manual')),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.agent_temp_pin_issues TO authenticated;
GRANT ALL ON public.agent_temp_pin_issues TO service_role;

ALTER TABLE public.agent_temp_pin_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read agent temp pin issues"
ON public.agent_temp_pin_issues FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents can read their own temp pin issues"
ON public.agent_temp_pin_issues FOR SELECT
TO authenticated
USING (agent_user_id = auth.uid());

CREATE INDEX idx_agent_temp_pin_issues_agent
  ON public.agent_temp_pin_issues (agent_user_id, created_at DESC);

CREATE INDEX idx_agent_temp_pin_issues_created
  ON public.agent_temp_pin_issues (created_at DESC);

-- ============================================================
-- 2. SMS delivery logs
-- ============================================================
CREATE TABLE public.sms_delivery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose text NOT NULL, -- e.g. 'agent_temp_pin'
  agent_user_id uuid,
  phone_masked text NOT NULL,
  status text NOT NULL CHECK (status IN ('sent','failed')),
  provider_status_code int,
  provider_response text,
  error_message text,
  issued_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sms_delivery_logs TO authenticated;
GRANT ALL ON public.sms_delivery_logs TO service_role;

ALTER TABLE public.sms_delivery_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read SMS delivery logs"
ON public.sms_delivery_logs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_sms_delivery_logs_agent
  ON public.sms_delivery_logs (agent_user_id, created_at DESC);

CREATE INDEX idx_sms_delivery_logs_created
  ON public.sms_delivery_logs (created_at DESC);

-- ============================================================
-- 3. Throttle helper — enforces 60s cooldown + 5/hour cap
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_agent_pin_reissue_throttle(_agent_user_id uuid)
RETURNS TABLE(allowed boolean, retry_after_seconds int, reason text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_at timestamptz;
  hourly_count int;
BEGIN
  SELECT created_at INTO last_at
    FROM public.agent_temp_pin_issues
   WHERE agent_user_id = _agent_user_id
   ORDER BY created_at DESC
   LIMIT 1;

  IF last_at IS NOT NULL AND now() - last_at < interval '60 seconds' THEN
    RETURN QUERY SELECT
      false,
      GREATEST(1, 60 - EXTRACT(EPOCH FROM (now() - last_at))::int),
      'cooldown'::text;
    RETURN;
  END IF;

  SELECT count(*) INTO hourly_count
    FROM public.agent_temp_pin_issues
   WHERE agent_user_id = _agent_user_id
     AND created_at > now() - interval '1 hour';

  IF hourly_count >= 5 THEN
    RETURN QUERY SELECT false, 3600, 'hourly_limit'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, 0, NULL::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_agent_pin_reissue_throttle(uuid) TO authenticated;

-- ============================================================
-- 4. Status helper — reports state of the agent's latest temp PIN
-- ============================================================
CREATE OR REPLACE FUNCTION public.agent_temp_pin_status(_agent_user_id uuid)
RETURNS TABLE(state text, expires_at timestamptz, issued_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  SELECT * INTO r
    FROM public.agent_temp_pin_issues
   WHERE agent_user_id = _agent_user_id
     AND superseded_at IS NULL
   ORDER BY created_at DESC
   LIMIT 1;

  IF r IS NULL THEN
    RETURN QUERY SELECT 'none'::text, NULL::timestamptz, NULL::timestamptz;
    RETURN;
  END IF;

  IF r.used_at IS NOT NULL THEN
    RETURN QUERY SELECT 'used'::text, r.expires_at, r.created_at;
    RETURN;
  END IF;

  IF r.expires_at <= now() THEN
    RETURN QUERY SELECT 'expired'::text, r.expires_at, r.created_at;
    RETURN;
  END IF;

  RETURN QUERY SELECT 'active'::text, r.expires_at, r.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.agent_temp_pin_status(uuid) TO authenticated;

-- ============================================================
-- 5. Mark used — retire an agent's active temp PIN after they change it
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_agent_temp_pin_used()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE public.agent_temp_pin_issues
     SET used_at = now()
   WHERE agent_user_id = auth.uid()
     AND used_at IS NULL
     AND superseded_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_agent_temp_pin_used() TO authenticated;
