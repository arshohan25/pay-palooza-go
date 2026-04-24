CREATE INDEX IF NOT EXISTS idx_profiles_user_id_phone_created_at
ON public.profiles (user_id, phone, created_at);

CREATE INDEX IF NOT EXISTS idx_profiles_phone_user_id_created_at
ON public.profiles (phone, user_id, created_at)
WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_balance_user_id_created_at
ON public.profiles (balance, user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_kyc_verifications_user_id
ON public.kyc_verifications (user_id);

CREATE INDEX IF NOT EXISTS idx_vendor_stores_merchant_id
ON public.vendor_stores (merchant_id);

CREATE INDEX IF NOT EXISTS idx_agents_user_id_created_at
ON public.agents (user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_orders_escrow_status_created_at
ON public.orders (escrow_status, created_at);

CREATE INDEX IF NOT EXISTS idx_transactions_fee_created_at
ON public.transactions (fee, created_at);

CREATE INDEX IF NOT EXISTS idx_merchant_payment_sessions_webhook_samples
ON public.merchant_payment_sessions (webhook_delivered, webhook_attempts, created_at);

CREATE INDEX IF NOT EXISTS idx_device_registrations_fingerprint_user_created_at
ON public.device_registrations (device_fingerprint, user_id, created_at)
WHERE device_fingerprint IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_data_quality_samples(p_check text, p_limit integer DEFAULT 25)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb := '[]'::jsonb;
  safe_limit integer := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 50);
BEGIN
  IF NOT public.is_admin_command_staff() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_check = 'Profiles without KYC records' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb) INTO result
    FROM (
      SELECT p.user_id, p.name, p.phone, p.status, p.created_at, 'profiles'::text AS source
      FROM public.profiles p
      WHERE p.phone NOT LIKE 'staff-%'
        AND NOT EXISTS (
          SELECT 1 FROM public.kyc_verifications k WHERE k.user_id = p.user_id
        )
      ORDER BY p.created_at DESC NULLS LAST
      LIMIT safe_limit
    ) s;
  ELSIF p_check = 'Merchants without stores' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb) INTO result
    FROM (
      SELECT m.id, m.user_id, m.business_name, m.status, m.created_at, 'merchants'::text AS source
      FROM public.merchants m
      WHERE NOT EXISTS (
        SELECT 1 FROM public.vendor_stores vs WHERE vs.merchant_id = m.id
      )
      ORDER BY m.created_at DESC NULLS LAST
      LIMIT safe_limit
    ) s;
  ELSIF p_check = 'Agents without float' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb) INTO result
    FROM (
      SELECT a.id, a.user_id, a.business_name, a.status, p.balance AS wallet_balance, a.max_float, a.created_at, 'agents:profile_balance'::text AS source
      FROM public.agents a
      LEFT JOIN public.profiles p ON p.user_id = a.user_id
      WHERE COALESCE(p.balance, 0) <= 0
      ORDER BY a.created_at DESC NULLS LAST
      LIMIT safe_limit
    ) s;
  ELSIF p_check = 'Orders without settlement status' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb) INTO result
    FROM (
      SELECT o.id, o.user_id, o.status, o.total, o.escrow_status, o.created_at, 'orders'::text AS source
      FROM public.orders o
      WHERE o.escrow_status IS NULL
      ORDER BY o.created_at DESC NULLS LAST
      LIMIT safe_limit
    ) s;
  ELSIF p_check = 'Transactions missing fees' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb) INTO result
    FROM (
      SELECT t.id, t.user_id, t.type, t.amount, t.fee, t.status, t.created_at, 'transactions'::text AS source
      FROM public.transactions t
      WHERE t.fee IS NULL
      ORDER BY t.created_at DESC NULLS LAST
      LIMIT safe_limit
    ) s;
  ELSIF p_check = 'Failed webhook delivery' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb) INTO result
    FROM (
      SELECT mps.id, mps.merchant_id, mps.reference, mps.status, mps.webhook_delivered, mps.webhook_attempts, mps.created_at, 'merchant_payment_sessions'::text AS source
      FROM public.merchant_payment_sessions mps
      WHERE mps.webhook_delivered = false
        AND COALESCE(mps.webhook_attempts, 0) > 0
      ORDER BY mps.created_at DESC NULLS LAST
      LIMIT safe_limit
    ) s;
  ELSIF p_check = 'Duplicate phone/device records' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb) INTO result
    FROM (
      SELECT p.user_id, p.name, p.phone AS duplicate_value, p.created_at, 'profiles:phone'::text AS source
      FROM public.profiles p
      WHERE p.phone IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.profiles p2
          WHERE p2.phone = p.phone AND p2.user_id <> p.user_id
        )
      UNION ALL
      SELECT d.user_id, NULL::text AS name, d.device_fingerprint AS duplicate_value, d.created_at, 'device_registrations:fingerprint'::text AS source
      FROM public.device_registrations d
      WHERE d.device_fingerprint IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.device_registrations d2
          WHERE d2.device_fingerprint = d.device_fingerprint AND d2.user_id <> d.user_id
        )
      ORDER BY created_at DESC NULLS LAST
      LIMIT safe_limit
    ) s;
  ELSE
    result := '[]'::jsonb;
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_data_quality_samples(text, integer) TO authenticated;