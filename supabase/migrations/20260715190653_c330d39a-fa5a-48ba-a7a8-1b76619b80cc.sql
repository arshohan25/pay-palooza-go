-- ── merchant_temp_pin_issues ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.merchant_temp_pin_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_user_id uuid NOT NULL,
  pin_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  issued_by uuid,
  issued_via text NOT NULL DEFAULT 'create',
  idempotency_key text,
  superseded_at timestamptz,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.merchant_temp_pin_issues TO authenticated;
GRANT ALL ON public.merchant_temp_pin_issues TO service_role;

ALTER TABLE public.merchant_temp_pin_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view merchant temp pin issues"
  ON public.merchant_temp_pin_issues
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert merchant temp pin issues"
  ON public.merchant_temp_pin_issues
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_merchant_temp_pin_issues_merchant
  ON public.merchant_temp_pin_issues (merchant_user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ux_merchant_temp_pin_idempotency
  ON public.merchant_temp_pin_issues (merchant_user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ── agent idempotency support ────────────────────────────────────────
ALTER TABLE public.agent_temp_pin_issues
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS ux_agent_temp_pin_idempotency
  ON public.agent_temp_pin_issues (agent_user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ── SMS log gets merchant link ───────────────────────────────────────
ALTER TABLE public.sms_delivery_logs
  ADD COLUMN IF NOT EXISTS merchant_user_id uuid;

-- ── Functions mirrored for merchants ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.merchant_temp_pin_status(_merchant_user_id uuid)
RETURNS TABLE(state text, expires_at timestamptz, issued_at timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
BEGIN
  SELECT * INTO r
    FROM public.merchant_temp_pin_issues
   WHERE merchant_user_id = _merchant_user_id
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
$function$;

CREATE OR REPLACE FUNCTION public.check_merchant_pin_reissue_throttle(_merchant_user_id uuid)
RETURNS TABLE(allowed boolean, retry_after_seconds integer, reason text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  last_at timestamptz;
  hourly_count int;
BEGIN
  SELECT created_at INTO last_at
    FROM public.merchant_temp_pin_issues
   WHERE merchant_user_id = _merchant_user_id
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
    FROM public.merchant_temp_pin_issues
   WHERE merchant_user_id = _merchant_user_id
     AND created_at > now() - interval '1 hour';

  IF hourly_count >= 5 THEN
    RETURN QUERY SELECT false, 3600, 'hourly_limit'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, 0, NULL::text;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_merchant_temp_pin_used()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE public.merchant_temp_pin_issues
     SET used_at = now()
   WHERE merchant_user_id = auth.uid()
     AND used_at IS NULL
     AND superseded_at IS NULL;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.merchant_temp_pin_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_temp_pin_status(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.check_merchant_pin_reissue_throttle(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_merchant_pin_reissue_throttle(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.mark_merchant_temp_pin_used() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_merchant_temp_pin_used() TO authenticated, service_role;