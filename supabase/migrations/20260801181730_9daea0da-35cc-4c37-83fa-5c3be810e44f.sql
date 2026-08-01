
CREATE TABLE IF NOT EXISTS public.loyalty_tier_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tier_id uuid NOT NULL REFERENCES public.loyalty_tiers(id) ON DELETE CASCADE,
  txn_type text NOT NULL,
  period text NOT NULL CHECK (period IN ('daily','monthly')),
  max_amount numeric NOT NULL DEFAULT 0,
  max_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tier_id, txn_type, period)
);

GRANT SELECT ON public.loyalty_tier_limits TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_tier_limits TO authenticated;
GRANT ALL ON public.loyalty_tier_limits TO service_role;

ALTER TABLE public.loyalty_tier_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tier limits are publicly readable" ON public.loyalty_tier_limits;
CREATE POLICY "Tier limits are publicly readable"
  ON public.loyalty_tier_limits FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage tier limits" ON public.loyalty_tier_limits;
CREATE POLICY "Admins manage tier limits"
  ON public.loyalty_tier_limits FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_loyalty_tier_limits_updated_at
  BEFORE UPDATE ON public.loyalty_tier_limits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Keep tier multipliers aligned with the new limit ladder (Starter 1x -> Signature 2.67x)
UPDATE public.loyalty_tiers SET limit_multiplier = 1.00 WHERE code = 'starter';
UPDATE public.loyalty_tiers SET limit_multiplier = 1.33 WHERE code = 'pro';
UPDATE public.loyalty_tiers SET limit_multiplier = 1.67 WHERE code = 'elite';
UPDATE public.loyalty_tiers SET limit_multiplier = 2.13 WHERE code = 'prime';
UPDATE public.loyalty_tiers SET limit_multiplier = 2.67 WHERE code = 'signature';

-- Seed the full matrix: base (Starter) values scaled by a per-tier factor.
WITH base(txn_type, daily_amount, daily_count) AS (
  VALUES
    ('send',         150000::numeric, 50),
    ('cashout',       50000::numeric, 20),
    ('cashin',        50000::numeric, 20),
    ('addmoney',     100000::numeric, 25),
    ('payment',      200000::numeric, 60),
    ('recharge',      20000::numeric, 50),
    ('paybill',      100000::numeric, 25),
    ('banktransfer', 150000::numeric, 40)
), f(code, factor) AS (
  VALUES ('starter',1.00::numeric),('pro',1.33::numeric),('elite',1.67::numeric),
         ('prime',2.13::numeric),('signature',2.67::numeric)
), rows AS (
  SELECT lt.id AS tier_id, b.txn_type, p.period,
    CASE WHEN p.period = 'daily'
      THEN round(b.daily_amount * f.factor, -2)
      ELSE round(b.daily_amount * f.factor * 10, -2) END AS max_amount,
    CASE WHEN p.period = 'daily'
      THEN ceil(b.daily_count * f.factor)::int
      ELSE ceil(b.daily_count * f.factor * 12)::int END AS max_count
  FROM public.loyalty_tiers lt
  JOIN f ON f.code = lt.code
  CROSS JOIN base b
  CROSS JOIN (VALUES ('daily'),('monthly')) AS p(period)
)
INSERT INTO public.loyalty_tier_limits (tier_id, txn_type, period, max_amount, max_count)
SELECT tier_id, txn_type, period, max_amount, max_count FROM rows
ON CONFLICT (tier_id, txn_type, period) DO UPDATE
  SET max_amount = EXCLUDED.max_amount,
      max_count = EXCLUDED.max_count,
      updated_at = now();

-- Effective limit resolver: user override > loyalty tier limit > platform default
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
  -- 1. Personal admin override
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

  -- 2. Effective loyalty tier
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

  -- 3. Platform default, scaled by the tier multiplier
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

GRANT EXECUTE ON FUNCTION public.get_effective_txn_limit(uuid, text, text) TO authenticated, service_role;
