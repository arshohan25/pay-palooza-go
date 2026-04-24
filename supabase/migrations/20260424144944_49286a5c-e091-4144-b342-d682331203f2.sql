CREATE OR REPLACE FUNCTION public.get_data_quality_samples(
  p_check text,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result_rows jsonb := '[]'::jsonb;
  page_rows jsonb := '[]'::jsonb;
  safe_limit integer := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 25);
  safe_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
  loaded_count integer := 0;
  has_more boolean := false;
BEGIN
  IF NOT public.is_admin_command_staff() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_check = 'Profiles without KYC records' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb) INTO result_rows
    FROM (
      SELECT p.user_id, p.name, p.phone, p.status, p.created_at, 'profiles'::text AS source
      FROM public.profiles p
      WHERE p.phone NOT LIKE 'staff-%'
        AND NOT EXISTS (
          SELECT 1 FROM public.kyc_verifications k WHERE k.user_id = p.user_id
        )
      ORDER BY p.created_at DESC NULLS LAST
      OFFSET safe_offset
      LIMIT safe_limit + 1
    ) s;
  ELSIF p_check = 'Merchants without stores' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb) INTO result_rows
    FROM (
      SELECT m.id, m.user_id, m.business_name, m.status, m.created_at, 'merchants'::text AS source
      FROM public.merchants m
      WHERE NOT EXISTS (
        SELECT 1 FROM public.vendor_stores vs WHERE vs.merchant_id = m.id
      )
      ORDER BY m.created_at DESC NULLS LAST
      OFFSET safe_offset
      LIMIT safe_limit + 1
    ) s;
  ELSIF p_check = 'Agents without float' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb) INTO result_rows
    FROM (
      SELECT a.id, a.user_id, a.business_name, a.status, p.balance AS wallet_balance, a.max_float, a.created_at, 'agents:profile_balance'::text AS source
      FROM public.agents a
      LEFT JOIN public.profiles p ON p.user_id = a.user_id
      WHERE COALESCE(p.balance, 0) <= 0
      ORDER BY a.created_at DESC NULLS LAST
      OFFSET safe_offset
      LIMIT safe_limit + 1
    ) s;
  ELSIF p_check = 'Orders without settlement status' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb) INTO result_rows
    FROM (
      SELECT o.id, o.user_id, o.status, o.total, o.escrow_status, o.created_at, 'orders'::text AS source
      FROM public.orders o
      WHERE o.escrow_status IS NULL
      ORDER BY o.created_at DESC NULLS LAST
      OFFSET safe_offset
      LIMIT safe_limit + 1
    ) s;
  ELSIF p_check = 'Transactions missing fees' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb) INTO result_rows
    FROM (
      SELECT t.id, t.user_id, t.type, t.amount, t.fee, t.status, t.created_at, 'transactions'::text AS source
      FROM public.transactions t
      WHERE t.fee IS NULL
      ORDER BY t.created_at DESC NULLS LAST
      OFFSET safe_offset
      LIMIT safe_limit + 1
    ) s;
  ELSIF p_check = 'Failed webhook delivery' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb) INTO result_rows
    FROM (
      SELECT mps.id, mps.merchant_id, mps.reference, mps.status, mps.webhook_delivered, mps.webhook_attempts, mps.created_at, 'merchant_payment_sessions'::text AS source
      FROM public.merchant_payment_sessions mps
      WHERE mps.webhook_delivered = false
        AND COALESCE(mps.webhook_attempts, 0) > 0
      ORDER BY mps.created_at DESC NULLS LAST
      OFFSET safe_offset
      LIMIT safe_limit + 1
    ) s;
  ELSIF p_check = 'Duplicate phone/device records' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb) INTO result_rows
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
      OFFSET safe_offset
      LIMIT safe_limit + 1
    ) s;
  END IF;

  loaded_count := jsonb_array_length(result_rows);
  has_more := loaded_count > safe_limit;

  SELECT COALESCE(jsonb_agg(value), '[]'::jsonb) INTO page_rows
  FROM (
    SELECT value
    FROM jsonb_array_elements(result_rows) WITH ORDINALITY AS items(value, ordinality)
    WHERE ordinality <= safe_limit
    ORDER BY ordinality
  ) trimmed;

  RETURN jsonb_build_object(
    'rows', page_rows,
    'limit', safe_limit,
    'offset', safe_offset,
    'loaded', jsonb_array_length(page_rows),
    'next_offset', safe_offset + jsonb_array_length(page_rows),
    'has_more', has_more
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_data_quality_samples(text, integer, integer) TO authenticated;