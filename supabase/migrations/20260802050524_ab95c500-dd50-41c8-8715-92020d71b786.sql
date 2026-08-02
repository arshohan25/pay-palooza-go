-- 1. Idempotency guard on accrual rows
CREATE UNIQUE INDEX IF NOT EXISTS loyalty_point_ledger_txn_kind_uniq
  ON public.loyalty_point_ledger (txn_id, kind)
  WHERE txn_id IS NOT NULL;

-- 2. Campaign multipliers
CREATE TABLE IF NOT EXISTS public.loyalty_point_multipliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  txn_type text,                        -- NULL = all transaction types
  multiplier numeric NOT NULL DEFAULT 1,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.loyalty_point_multipliers TO authenticated;
GRANT ALL ON public.loyalty_point_multipliers TO service_role;
ALTER TABLE public.loyalty_point_multipliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lpm read active" ON public.loyalty_point_multipliers;
CREATE POLICY "lpm read active" ON public.loyalty_point_multipliers
  FOR SELECT TO authenticated USING (is_active = true);

DROP POLICY IF EXISTS "lpm admin manage" ON public.loyalty_point_multipliers;
CREATE POLICY "lpm admin manage" ON public.loyalty_point_multipliers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_lpm_touch BEFORE UPDATE ON public.loyalty_point_multipliers
  FOR EACH ROW EXECUTE FUNCTION public.touch_loyalty_updated_at();

-- 3. Accrual engine: campaign multiplier + replay protection
CREATE OR REPLACE FUNCTION public.award_loyalty_points(_user_id uuid, _txn_type text, _amount numeric, _txn_id uuid DEFAULT NULL::uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tier_id uuid;
  v_tier_code text;
  v_rule record;
  v_mult numeric := 1;
  v_mult_name text;
  v_points integer := 0;
  v_new integer;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RETURN 0; END IF;

  -- replay protection: one accrual row per transaction
  IF _txn_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.loyalty_point_ledger
    WHERE txn_id = _txn_id AND kind = 'accrual'
  ) THEN
    RETURN 0;
  END IF;

  -- KYC gate: only verified customers earn
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = _user_id AND p.kyc_status = 'verified'
  ) THEN
    RETURN 0;
  END IF;

  SELECT CASE
           WHEN ul.override_tier_id IS NOT NULL
                AND (ul.override_until IS NULL OR ul.override_until > now())
             THEN ul.override_tier_id
           ELSE ul.current_tier_id
         END
    INTO v_tier_id
  FROM public.user_loyalty ul WHERE ul.user_id = _user_id;

  IF v_tier_id IS NULL THEN
    SELECT lt.id INTO v_tier_id FROM public.loyalty_tiers lt
    WHERE lt.is_active = true ORDER BY lt.rank ASC LIMIT 1;
  END IF;

  SELECT code INTO v_tier_code FROM public.loyalty_tiers WHERE id = v_tier_id;

  SELECT * INTO v_rule FROM public.loyalty_point_rules
  WHERE tier_id = v_tier_id AND txn_type = _txn_type AND is_active = true LIMIT 1;

  IF v_rule.id IS NULL OR _amount < v_rule.min_amount THEN RETURN 0; END IF;

  -- best active campaign multiplier for this txn type
  SELECT m.multiplier, m.name INTO v_mult, v_mult_name
  FROM public.loyalty_point_multipliers m
  WHERE m.is_active = true
    AND m.starts_at <= now()
    AND (m.ends_at IS NULL OR m.ends_at > now())
    AND (m.txn_type IS NULL OR m.txn_type = _txn_type)
  ORDER BY m.multiplier DESC
  LIMIT 1;
  v_mult := GREATEST(COALESCE(v_mult, 1), 1);

  v_points := FLOOR((_amount / 100.0) * v_rule.points_per_100 * v_mult)::integer;
  IF v_points <= 0 THEN RETURN 0; END IF;

  INSERT INTO public.user_loyalty_points (user_id, points_balance, lifetime_earned)
  VALUES (_user_id, v_points, v_points)
  ON CONFLICT (user_id) DO UPDATE
    SET points_balance = public.user_loyalty_points.points_balance + v_points,
        lifetime_earned = public.user_loyalty_points.lifetime_earned + v_points,
        updated_at = now()
  RETURNING points_balance INTO v_new;

  INSERT INTO public.loyalty_point_ledger
    (user_id, kind, points, balance_after, txn_type, txn_id, amount, tier_code, description)
  VALUES (_user_id, 'accrual', v_points, v_new, _txn_type, _txn_id, _amount, v_tier_code,
          'Points earned on ' || _txn_type || ' of ' || _amount::text
          || CASE WHEN v_mult > 1 THEN ' (x' || v_mult::text || ' ' || COALESCE(v_mult_name, 'campaign') || ')' ELSE '' END)
  ON CONFLICT DO NOTHING;

  RETURN v_points;
END;
$function$;

-- 4. Accrual on cash out / pay bill / payment, driven by the money ledger
CREATE OR REPLACE FUNCTION public.trg_award_loyalty_on_txn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status <> 'completed' THEN RETURN NEW; END IF;
  IF NEW.type::text NOT IN ('cashout', 'paybill', 'payment') THEN RETURN NEW; END IF;
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN RETURN NEW; END IF;
  IF COALESCE(NEW.commission, 0) > 0 THEN RETURN NEW; END IF;  -- partner leg, not a customer leg

  -- customers only: skip any account holding an elevated role
  IF EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = NEW.user_id AND ur.role <> 'customer'::app_role
  ) THEN
    RETURN NEW;
  END IF;

  PERFORM public.award_loyalty_points(NEW.user_id, NEW.type::text, NEW.amount, NEW.id);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_award_loyalty_on_txn_ins ON public.transactions;
CREATE TRIGGER trg_award_loyalty_on_txn_ins
  AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.trg_award_loyalty_on_txn();

DROP TRIGGER IF EXISTS trg_award_loyalty_on_txn_upd ON public.transactions;
CREATE TRIGGER trg_award_loyalty_on_txn_upd
  AFTER UPDATE OF status ON public.transactions
  FOR EACH ROW WHEN (NEW.status = 'completed' AND OLD.status <> 'completed')
  EXECUTE FUNCTION public.trg_award_loyalty_on_txn();

-- 5. Points expiry after 6 months of inactivity (30-day warning first)
CREATE OR REPLACE FUNCTION public.expire_inactive_loyalty_points()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_warned integer := 0;
  v_expired integer := 0;
  v_points integer;
BEGIN
  -- 30-day warning window (5 months of inactivity)
  FOR r IN
    SELECT ulp.user_id, ulp.points_balance,
           COALESCE(
             (SELECT max(l.created_at) FROM public.loyalty_point_ledger l WHERE l.user_id = ulp.user_id),
             ulp.updated_at
           ) AS last_activity
    FROM public.user_loyalty_points ulp
    WHERE ulp.points_balance > 0
  LOOP
    IF r.last_activity <= now() - interval '6 months' THEN
      v_points := r.points_balance;
      UPDATE public.user_loyalty_points
         SET points_balance = 0, updated_at = now()
       WHERE user_id = r.user_id;

      INSERT INTO public.loyalty_point_ledger
        (user_id, kind, points, balance_after, description)
      VALUES (r.user_id, 'expiry', -v_points, 0,
              v_points::text || ' points expired after 6 months of inactivity');

      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (r.user_id, 'Loyalty points expired',
              v_points::text || ' EasyPay Club points expired after 6 months of inactivity.',
              'loyalty');
      v_expired := v_expired + 1;

    ELSIF r.last_activity <= now() - interval '5 months'
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = r.user_id
          AND n.type = 'loyalty'
          AND n.title = 'Points expiring soon'
          AND n.created_at > now() - interval '30 days'
      ) THEN
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (r.user_id, 'Points expiring soon',
              'Your ' || r.points_balance::text ||
              ' EasyPay Club points expire in 30 days. Send money or redeem to keep them.',
              'loyalty');
      v_warned := v_warned + 1;
    END IF;
  END LOOP;

  RETURN json_build_object('warned', v_warned, 'expired', v_expired);
END;
$function$;

REVOKE ALL ON FUNCTION public.expire_inactive_loyalty_points() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_inactive_loyalty_points() TO service_role;