
-- ============================================================
-- EasyPay Club Loyalty Tier System
-- ============================================================

-- 1) TIER CATALOG (admin-configurable)
CREATE TABLE public.loyalty_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,                    -- 'starter','pro','elite','prime','signature'
  name text NOT NULL,                            -- display name (EN)
  name_bn text,                                  -- display name (BN)
  rank int NOT NULL UNIQUE,                      -- 1..N, higher = better
  -- thresholds (ALL must be met to qualify; NULL = ignored)
  min_volume_30d numeric(14,2) DEFAULT 0,
  min_lifetime_txn_count int DEFAULT 0,
  min_wallet_balance numeric(14,2) DEFAULT 0,
  min_addmoney_lifetime numeric(14,2) DEFAULT 0,
  min_savings_balance numeric(14,2) DEFAULT 0,
  min_combined_score numeric(14,2) DEFAULT 0,
  -- perks
  limit_multiplier numeric(4,2) NOT NULL DEFAULT 1.00,  -- multiplies daily/monthly limits
  fee_discount_pct numeric(5,2) NOT NULL DEFAULT 0,     -- 0..100 (% off send/cashout fees)
  cashback_bonus_pct numeric(5,2) NOT NULL DEFAULT 0,   -- extra cashback multiplier
  priority_support boolean NOT NULL DEFAULT false,
  -- visuals
  badge_color text NOT NULL DEFAULT '#94a3b8',          -- hex
  badge_icon text NOT NULL DEFAULT 'Award',             -- lucide icon name
  gradient_from text,
  gradient_to text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.loyalty_tiers TO authenticated, anon;
GRANT ALL ON public.loyalty_tiers TO service_role;

ALTER TABLE public.loyalty_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active tiers"
  ON public.loyalty_tiers FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage tiers"
  ON public.loyalty_tiers FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- 2) USER LOYALTY (one row per user)
CREATE TABLE public.user_loyalty (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_tier_id uuid REFERENCES public.loyalty_tiers(id),
  override_tier_id uuid REFERENCES public.loyalty_tiers(id),  -- admin-forced tier (wins if set)
  override_reason text,
  override_by uuid REFERENCES auth.users(id),
  override_until timestamptz,                                 -- optional expiry
  -- snapshot metrics
  score numeric(14,2) NOT NULL DEFAULT 0,
  volume_30d numeric(14,2) NOT NULL DEFAULT 0,
  lifetime_txn_count int NOT NULL DEFAULT 0,
  wallet_balance numeric(14,2) NOT NULL DEFAULT 0,
  addmoney_lifetime numeric(14,2) NOT NULL DEFAULT 0,
  savings_balance numeric(14,2) NOT NULL DEFAULT 0,
  last_recalculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.user_loyalty TO authenticated;
GRANT ALL ON public.user_loyalty TO service_role;

ALTER TABLE public.user_loyalty ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own loyalty"
  ON public.user_loyalty FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage all loyalty"
  ON public.user_loyalty FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- 3) AUDIT HISTORY
CREATE TABLE public.loyalty_tier_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_tier_id uuid REFERENCES public.loyalty_tiers(id),
  to_tier_id uuid REFERENCES public.loyalty_tiers(id),
  change_type text NOT NULL CHECK (change_type IN ('auto_promoted','auto_demoted','admin_override','override_cleared','initial')),
  reason text,
  changed_by uuid REFERENCES auth.users(id),
  snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.loyalty_tier_audit TO authenticated;
GRANT ALL ON public.loyalty_tier_audit TO service_role;

ALTER TABLE public.loyalty_tier_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own tier history"
  ON public.loyalty_tier_audit FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert audit"
  ON public.loyalty_tier_audit FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_loyalty_audit_user ON public.loyalty_tier_audit(user_id, created_at DESC);


-- 4) updated_at triggers
CREATE OR REPLACE FUNCTION public.touch_loyalty_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_loyalty_tiers_updated BEFORE UPDATE ON public.loyalty_tiers
  FOR EACH ROW EXECUTE FUNCTION public.touch_loyalty_updated_at();
CREATE TRIGGER trg_user_loyalty_updated BEFORE UPDATE ON public.user_loyalty
  FOR EACH ROW EXECUTE FUNCTION public.touch_loyalty_updated_at();


-- 5) RECALC FUNCTION
CREATE OR REPLACE FUNCTION public.recalculate_user_loyalty(_user_id uuid)
RETURNS uuid  -- returns the selected tier id
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_volume_30d numeric := 0;
  v_txn_count int := 0;
  v_wallet numeric := 0;
  v_addmoney numeric := 0;
  v_savings numeric := 0;
  v_score numeric := 0;
  v_selected uuid;
  v_override uuid;
  v_prev uuid;
BEGIN
  -- 30-day outgoing volume
  SELECT COALESCE(SUM(amount),0) INTO v_volume_30d
  FROM public.transactions
  WHERE sender_id = _user_id
    AND status = 'completed'
    AND created_at >= now() - interval '30 days';

  -- lifetime txn count (as sender or receiver)
  SELECT COALESCE(COUNT(*),0) INTO v_txn_count
  FROM public.transactions
  WHERE (sender_id = _user_id OR receiver_id = _user_id) AND status = 'completed';

  -- wallet balance
  SELECT COALESCE(balance,0) INTO v_wallet
  FROM public.profiles WHERE user_id = _user_id;

  -- lifetime add money
  SELECT COALESCE(SUM(amount),0) INTO v_addmoney
  FROM public.transactions
  WHERE receiver_id = _user_id AND type = 'add_money' AND status = 'completed';

  -- savings (goals + auto_save current balances)
  SELECT COALESCE((SELECT SUM(current_amount) FROM public.savings_goals WHERE user_id = _user_id),0)
       + COALESCE((SELECT SUM(current_balance) FROM public.savings_auto_save WHERE user_id = _user_id),0)
  INTO v_savings;

  -- combined score (tunable weights)
  v_score := (v_volume_30d * 0.001) + (v_txn_count * 2) + (v_wallet * 0.002)
           + (v_addmoney * 0.0005) + (v_savings * 0.003);

  -- pick highest tier where all thresholds are met
  SELECT id INTO v_selected
  FROM public.loyalty_tiers
  WHERE is_active
    AND v_volume_30d       >= COALESCE(min_volume_30d,0)
    AND v_txn_count        >= COALESCE(min_lifetime_txn_count,0)
    AND v_wallet           >= COALESCE(min_wallet_balance,0)
    AND v_addmoney         >= COALESCE(min_addmoney_lifetime,0)
    AND v_savings          >= COALESCE(min_savings_balance,0)
    AND v_score            >= COALESCE(min_combined_score,0)
  ORDER BY rank DESC
  LIMIT 1;

  -- previous tier
  SELECT current_tier_id, override_tier_id INTO v_prev, v_override
  FROM public.user_loyalty WHERE user_id = _user_id;

  -- override wins (if set and not expired)
  IF v_override IS NOT NULL THEN
    SELECT CASE
      WHEN (SELECT override_until FROM public.user_loyalty WHERE user_id = _user_id) IS NULL
        OR (SELECT override_until FROM public.user_loyalty WHERE user_id = _user_id) > now()
      THEN v_override ELSE v_selected END
    INTO v_selected;
  END IF;

  INSERT INTO public.user_loyalty (
    user_id, current_tier_id, score, volume_30d, lifetime_txn_count,
    wallet_balance, addmoney_lifetime, savings_balance, last_recalculated_at
  ) VALUES (
    _user_id, v_selected, v_score, v_volume_30d, v_txn_count,
    v_wallet, v_addmoney, v_savings, now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    current_tier_id = EXCLUDED.current_tier_id,
    score = EXCLUDED.score,
    volume_30d = EXCLUDED.volume_30d,
    lifetime_txn_count = EXCLUDED.lifetime_txn_count,
    wallet_balance = EXCLUDED.wallet_balance,
    addmoney_lifetime = EXCLUDED.addmoney_lifetime,
    savings_balance = EXCLUDED.savings_balance,
    last_recalculated_at = now();

  -- log if tier changed
  IF v_prev IS DISTINCT FROM v_selected THEN
    INSERT INTO public.loyalty_tier_audit (user_id, from_tier_id, to_tier_id, change_type, snapshot)
    VALUES (
      _user_id, v_prev, v_selected,
      CASE WHEN v_prev IS NULL THEN 'initial'
           WHEN (SELECT rank FROM public.loyalty_tiers WHERE id = v_selected) >
                COALESCE((SELECT rank FROM public.loyalty_tiers WHERE id = v_prev),0)
             THEN 'auto_promoted'
           ELSE 'auto_demoted' END,
      jsonb_build_object('volume_30d',v_volume_30d,'txn_count',v_txn_count,
                         'wallet',v_wallet,'addmoney',v_addmoney,'savings',v_savings,'score',v_score)
    );
  END IF;

  RETURN v_selected;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_user_loyalty(uuid) TO authenticated, service_role;


-- 6) ADMIN OVERRIDE RPC
CREATE OR REPLACE FUNCTION public.admin_set_loyalty_override(
  _target_user_id uuid,
  _tier_id uuid,          -- pass NULL to clear override
  _reason text DEFAULT NULL,
  _until timestamptz DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prev uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can override loyalty tiers';
  END IF;

  SELECT current_tier_id INTO v_prev FROM public.user_loyalty WHERE user_id = _target_user_id;

  INSERT INTO public.user_loyalty (user_id, override_tier_id, override_reason, override_by, override_until, current_tier_id)
  VALUES (_target_user_id, _tier_id, _reason, auth.uid(), _until, COALESCE(_tier_id, v_prev))
  ON CONFLICT (user_id) DO UPDATE SET
    override_tier_id = _tier_id,
    override_reason = _reason,
    override_by = auth.uid(),
    override_until = _until,
    current_tier_id = COALESCE(_tier_id, EXCLUDED.current_tier_id);

  INSERT INTO public.loyalty_tier_audit (user_id, from_tier_id, to_tier_id, change_type, reason, changed_by)
  VALUES (_target_user_id, v_prev, _tier_id,
          CASE WHEN _tier_id IS NULL THEN 'override_cleared' ELSE 'admin_override' END,
          _reason, auth.uid());

  -- recompute so metrics stay fresh
  PERFORM public.recalculate_user_loyalty(_target_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_loyalty_override(uuid,uuid,text,timestamptz) TO authenticated;


-- 7) SEED default EasyPay Club tiers
INSERT INTO public.loyalty_tiers
(code, name, name_bn, rank, min_volume_30d, min_lifetime_txn_count, min_wallet_balance, min_addmoney_lifetime, min_savings_balance,
 limit_multiplier, fee_discount_pct, cashback_bonus_pct, priority_support,
 badge_color, badge_icon, gradient_from, gradient_to, description)
VALUES
 ('starter',   'Starter',   'শুরু',       1,      0,   0,     0,      0,      0,   1.00, 0,   0,   false, '#94a3b8', 'Sparkles',   '#94a3b8', '#64748b', 'Welcome to EasyPay Club'),
 ('pro',       'Pro',       'প্রো',       2,  10000,  20,   500,   5000,      0,   1.25, 5,   1,   false, '#3b82f6', 'Zap',        '#60a5fa', '#2563eb', 'Active users get more'),
 ('elite',     'Elite',     'এলিট',      3,  50000,  75,  2500,  25000,   1000,   1.50, 10,  2,   true,  '#a855f7', 'Award',      '#c084fc', '#7c3aed', 'Trusted power users'),
 ('prime',     'Prime',     'প্রাইম',    4, 200000, 250, 10000, 100000,  10000,   2.00, 20,  3,   true,  '#f59e0b', 'Crown',      '#fbbf24', '#d97706', 'Top-tier privileges'),
 ('signature', 'Signature', 'সিগনেচার',  5, 500000, 500, 25000, 300000,  50000,   3.00, 40,  5,   true,  '#10b981', 'Gem',        '#34d399', '#059669', 'EasyPay VIP experience')
ON CONFLICT (code) DO NOTHING;
