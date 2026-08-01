
CREATE OR REPLACE FUNCTION public.get_effective_txn_limit(
  _user_id uuid, _txn_type text, _period text
)
RETURNS TABLE (max_amount numeric, max_count integer, source text, tier_code text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier_id uuid;
  v_tier_code text;
  v_mult numeric := 1;
  v_amount numeric;
  v_count integer;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() <> _user_id AND NOT public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT ulo.max_amount, ulo.max_count INTO v_amount, v_count
  FROM public.user_limit_overrides ulo
  WHERE ulo.target_user_id = _user_id
    AND ulo.txn_type = _txn_type
    AND ulo.period = _period
    AND ulo.is_active = true
    AND (ulo.expires_at IS NULL OR ulo.expires_at > now())
  LIMIT 1;

  IF v_amount IS NOT NULL THEN
    RETURN QUERY SELECT v_amount, COALESCE(v_count, 0), 'user_override'::text, NULL::text;
    RETURN;
  END IF;

  SELECT CASE
           WHEN ul.override_tier_id IS NOT NULL
                AND (ul.override_until IS NULL OR ul.override_until > now())
             THEN ul.override_tier_id
           ELSE ul.current_tier_id
         END
    INTO v_tier_id
  FROM public.user_loyalty ul
  WHERE ul.user_id = _user_id;

  IF v_tier_id IS NULL THEN
    SELECT lt.id INTO v_tier_id
    FROM public.loyalty_tiers lt
    WHERE lt.is_active = true
    ORDER BY lt.rank ASC
    LIMIT 1;
  END IF;

  SELECT lt.code, COALESCE(lt.limit_multiplier, 1) INTO v_tier_code, v_mult
  FROM public.loyalty_tiers lt WHERE lt.id = v_tier_id;

  SELECT ltl.max_amount, ltl.max_count INTO v_amount, v_count
  FROM public.loyalty_tier_limits ltl
  WHERE ltl.tier_id = v_tier_id
    AND ltl.txn_type = _txn_type
    AND ltl.period = _period
  LIMIT 1;

  IF v_amount IS NOT NULL THEN
    RETURN QUERY SELECT v_amount, COALESCE(v_count, 0), 'tier_limit'::text, v_tier_code;
    RETURN;
  END IF;

  SELECT tl.max_amount, tl.max_count INTO v_amount, v_count
  FROM public.transaction_limits tl
  WHERE tl.txn_type = _txn_type
    AND tl.period = _period
    AND tl.applies_to = 'user'
    AND tl.is_active = true
  LIMIT 1;

  RETURN QUERY SELECT COALESCE(v_amount, 0) * v_mult, COALESCE(v_count, 0),
                      'platform_default'::text, v_tier_code;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_effective_txn_limit(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_effective_txn_limit(uuid, text, text) TO authenticated, service_role;
