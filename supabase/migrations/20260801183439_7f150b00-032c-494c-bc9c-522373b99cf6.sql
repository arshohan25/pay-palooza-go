-- ═══════════════════════════════════════════════════════════════
-- 1. Internal limit resolver (no auth gate; used by SECURITY DEFINER flows)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.resolve_txn_limit_internal(_user_id uuid, _txn_type text, _period text)
RETURNS TABLE(max_amount numeric, max_count integer, source text, tier_code text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tier_id uuid;
  v_tier_code text;
  v_mult numeric := 1;
  v_amount numeric;
  v_count integer;
BEGIN
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
    SELECT lt.id INTO v_tier_id FROM public.loyalty_tiers lt
    WHERE lt.is_active = true ORDER BY lt.rank ASC LIMIT 1;
  END IF;

  SELECT lt.code, COALESCE(lt.limit_multiplier, 1) INTO v_tier_code, v_mult
  FROM public.loyalty_tiers lt WHERE lt.id = v_tier_id;

  SELECT ltl.max_amount, ltl.max_count INTO v_amount, v_count
  FROM public.loyalty_tier_limits ltl
  WHERE ltl.tier_id = v_tier_id AND ltl.txn_type = _txn_type AND ltl.period = _period
  LIMIT 1;

  IF v_amount IS NOT NULL THEN
    RETURN QUERY SELECT v_amount, COALESCE(v_count, 0), 'tier_limit'::text, v_tier_code;
    RETURN;
  END IF;

  SELECT tl.max_amount, tl.max_count INTO v_amount, v_count
  FROM public.transaction_limits tl
  WHERE tl.txn_type = _txn_type AND tl.period = _period
    AND tl.applies_to = 'user' AND tl.is_active = true
  LIMIT 1;

  RETURN QUERY SELECT COALESCE(v_amount, 0) * v_mult, COALESCE(v_count, 0),
                      'platform_default'::text, v_tier_code;
END;
$function$;

-- ═══════════════════════════════════════════════════════════════
-- 2. Limit status (user-facing: limit, used, remaining, count)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_txn_limit_status(_txn_type text)
RETURNS TABLE(
  period text, max_amount numeric, max_count integer, source text, tier_code text,
  used_amount numeric, used_count integer, remaining_amount numeric, remaining_count integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  p text;
  r record;
  v_used numeric;
  v_cnt integer;
  v_start timestamptz;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  FOREACH p IN ARRAY ARRAY['daily','monthly'] LOOP
    SELECT * INTO r FROM public.resolve_txn_limit_internal(v_uid, _txn_type, p);
    v_start := CASE WHEN p = 'daily' THEN date_trunc('day', now()) ELSE date_trunc('month', now()) END;

    SELECT COALESCE(SUM(t.amount), 0), COUNT(*) INTO v_used, v_cnt
    FROM public.transactions t
    WHERE t.user_id = v_uid AND t.type::text = _txn_type
      AND t.status = 'completed' AND t.created_at >= v_start;

    RETURN QUERY SELECT
      p,
      COALESCE(r.max_amount, 0),
      COALESCE(r.max_count, 0),
      COALESCE(r.source, 'unknown'),
      r.tier_code,
      v_used,
      v_cnt,
      CASE WHEN COALESCE(r.max_amount,0) <= 0 THEN NULL ELSE GREATEST(r.max_amount - v_used, 0) END,
      CASE WHEN COALESCE(r.max_count,0) <= 0 THEN NULL ELSE GREATEST(r.max_count - v_cnt, 0) END;
  END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_txn_limit_status(text) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 3. Hard enforcement guard used inside money-moving RPCs
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.enforce_txn_limit(_user_id uuid, _txn_type text, _amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  p text;
  r record;
  v_used numeric;
  v_cnt integer;
  v_start timestamptz;
  v_label text;
  v_remaining numeric;
BEGIN
  FOREACH p IN ARRAY ARRAY['daily','monthly'] LOOP
    SELECT * INTO r FROM public.resolve_txn_limit_internal(_user_id, _txn_type, p);
    v_label := CASE WHEN p = 'daily' THEN 'daily' ELSE 'monthly' END;
    v_start := CASE WHEN p = 'daily' THEN date_trunc('day', now()) ELSE date_trunc('month', now()) END;

    SELECT COALESCE(SUM(t.amount), 0), COUNT(*) INTO v_used, v_cnt
    FROM public.transactions t
    WHERE t.user_id = _user_id AND t.type::text = _txn_type
      AND t.status = 'completed' AND t.created_at >= v_start;

    IF COALESCE(r.max_amount, 0) > 0 AND (v_used + _amount) > r.max_amount THEN
      v_remaining := GREATEST(r.max_amount - v_used, 0);
      RAISE EXCEPTION
        'LIMIT_EXCEEDED|%|amount|%|%|%|%',
        v_label, r.max_amount, v_used, v_remaining, COALESCE(r.tier_code, '')
        USING HINT = 'Your ' || v_label || ' ' || _txn_type || ' limit is ' || r.max_amount::text
                     || '. Used ' || v_used::text || '. Remaining ' || v_remaining::text || '.';
    END IF;

    IF COALESCE(r.max_count, 0) > 0 AND (v_cnt + 1) > r.max_count THEN
      RAISE EXCEPTION
        'LIMIT_EXCEEDED|%|count|%|%|%|%',
        v_label, r.max_count, v_cnt, GREATEST(r.max_count - v_cnt, 0), COALESCE(r.tier_code, '')
        USING HINT = 'You reached your ' || v_label || ' transaction count limit of ' || r.max_count::text || '.';
    END IF;
  END LOOP;
END;
$function$;

-- ═══════════════════════════════════════════════════════════════
-- 4. Loyalty points: rules, balances, ledger
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.loyalty_point_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_id uuid NOT NULL REFERENCES public.loyalty_tiers(id) ON DELETE CASCADE,
  txn_type text NOT NULL DEFAULT 'send',
  points_per_100 numeric NOT NULL DEFAULT 1,
  min_amount numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tier_id, txn_type)
);
GRANT SELECT ON public.loyalty_point_rules TO authenticated;
GRANT ALL ON public.loyalty_point_rules TO service_role;
ALTER TABLE public.loyalty_point_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Point rules readable by authenticated"
  ON public.loyalty_point_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage point rules"
  ON public.loyalty_point_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.user_loyalty_points (
  user_id uuid PRIMARY KEY,
  points_balance integer NOT NULL DEFAULT 0,
  lifetime_earned integer NOT NULL DEFAULT 0,
  lifetime_redeemed integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_loyalty_points TO authenticated;
GRANT ALL ON public.user_loyalty_points TO service_role;
ALTER TABLE public.user_loyalty_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own points"
  ON public.user_loyalty_points FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.loyalty_point_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  points integer NOT NULL,
  balance_after integer NOT NULL,
  txn_type text,
  txn_id uuid,
  amount numeric,
  tier_code text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loyalty_point_ledger_user ON public.loyalty_point_ledger(user_id, created_at DESC);
GRANT SELECT ON public.loyalty_point_ledger TO authenticated;
GRANT ALL ON public.loyalty_point_ledger TO service_role;
ALTER TABLE public.loyalty_point_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own point ledger"
  ON public.loyalty_point_ledger FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_loyalty_point_rules_updated_at
  BEFORE UPDATE ON public.loyalty_point_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed Send Money rules per tier: Starter 1 → Signature 3 points / ৳100
INSERT INTO public.loyalty_point_rules (tier_id, txn_type, points_per_100, min_amount)
SELECT lt.id, 'send',
       CASE lt.code WHEN 'starter' THEN 1 WHEN 'pro' THEN 1.5 WHEN 'elite' THEN 2
                    WHEN 'prime' THEN 2.5 WHEN 'signature' THEN 3 ELSE 1 END,
       50
FROM public.loyalty_tiers lt
ON CONFLICT (tier_id, txn_type) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- 5. Accrual + redemption
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.award_loyalty_points(
  _user_id uuid, _txn_type text, _amount numeric, _txn_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tier_id uuid;
  v_tier_code text;
  v_rule record;
  v_points integer := 0;
  v_new integer;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RETURN 0; END IF;

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

  v_points := FLOOR((_amount / 100.0) * v_rule.points_per_100)::integer;
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
          'Points earned on ' || _txn_type || ' of ' || _amount::text);

  RETURN v_points;
END;
$function$;

CREATE OR REPLACE FUNCTION public.redeem_loyalty_points(_points integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_rate numeric := 0.10;   -- ৳0.10 per point (100 pts = ৳10)
  v_min integer := 500;
  v_bal integer;
  v_new integer;
  v_cash numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _points IS NULL OR _points <= 0 THEN RAISE EXCEPTION 'Points must be positive'; END IF;
  IF _points % 100 <> 0 THEN RAISE EXCEPTION 'Points must be redeemed in multiples of 100'; END IF;
  IF _points < v_min THEN RAISE EXCEPTION 'Minimum redemption is % points', v_min; END IF;

  SELECT points_balance INTO v_bal FROM public.user_loyalty_points
  WHERE user_id = v_uid FOR UPDATE;

  IF v_bal IS NULL OR v_bal < _points THEN
    RAISE EXCEPTION 'Not enough points. You have % points.', COALESCE(v_bal, 0);
  END IF;

  v_cash := ROUND(_points * v_rate, 2);
  v_new := v_bal - _points;

  UPDATE public.user_loyalty_points
     SET points_balance = v_new,
         lifetime_redeemed = lifetime_redeemed + _points,
         updated_at = now()
   WHERE user_id = v_uid;

  PERFORM public.credit_user_balance(v_uid, v_cash);

  INSERT INTO public.loyalty_point_ledger
    (user_id, kind, points, balance_after, amount, description)
  VALUES (v_uid, 'redemption', -_points, v_new, v_cash,
          'Redeemed ' || _points::text || ' points for ' || v_cash::text || ' wallet credit');

  RETURN json_build_object('success', true, 'points_redeemed', _points,
                           'cash_credited', v_cash, 'points_balance', v_new);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.redeem_loyalty_points(integer) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 6. Wire enforcement + accrual into transfer_money
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.transfer_money(p_recipient_phone text, p_amount numeric, p_fee numeric DEFAULT 0, p_type txn_type DEFAULT 'send'::txn_type, p_description text DEFAULT NULL::text, p_reference text DEFAULT NULL::text, p_recipient_name text DEFAULT NULL::text, p_recipient_type txn_type DEFAULT 'receive'::txn_type, p_commission numeric DEFAULT 0)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sender_id UUID;
  v_sender_balance NUMERIC;
  v_recipient_profile RECORD;
  v_total_deduction NUMERIC;
  v_sender_new_balance NUMERIC;
  v_recipient_new_balance NUMERIC;
  v_sender_txn_id UUID;
  v_recipient_txn_id UUID;
  v_rate_count INT;
  v_treasury RECORD;
  v_new_treasury_balance NUMERIC;
  v_dup_count INT;
BEGIN
  v_sender_id := auth.uid();
  IF v_sender_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  PERFORM require_kyc_verified(v_sender_id);

  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF p_amount > 1000000 THEN RAISE EXCEPTION 'Amount exceeds maximum limit'; END IF;
  IF p_fee IS NULL OR p_fee < 0 THEN RAISE EXCEPTION 'Fee cannot be negative'; END IF;
  IF p_fee > p_amount THEN RAISE EXCEPTION 'Fee cannot exceed amount'; END IF;
  IF p_commission IS NULL OR p_commission < 0 THEN RAISE EXCEPTION 'Commission cannot be negative'; END IF;
  IF p_commission > p_amount THEN RAISE EXCEPTION 'Commission cannot exceed amount'; END IF;
  IF p_recipient_phone IS NULL OR LENGTH(p_recipient_phone) < 3 THEN RAISE EXCEPTION 'Invalid recipient'; END IF;
  IF p_description IS NOT NULL AND LENGTH(p_description) > 500 THEN RAISE EXCEPTION 'Description too long'; END IF;
  IF p_reference IS NOT NULL AND LENGTH(p_reference) > 100 THEN RAISE EXCEPTION 'Reference too long'; END IF;

  -- Duplicate send guard
  IF p_type = 'send' THEN
    SELECT COUNT(*) INTO v_dup_count
    FROM transactions
    WHERE user_id = v_sender_id
      AND type = 'send'
      AND recipient_phone = p_recipient_phone
      AND amount = p_amount
      AND status = 'completed'
      AND created_at > (now() - interval '5 minutes');
    IF v_dup_count > 0 THEN
      RAISE EXCEPTION 'Duplicate transaction: you already sent ৳% to this number within the last 5 minutes. Please wait before sending the same amount again.', p_amount;
    END IF;
  END IF;

  -- Daily / monthly ceiling enforcement at creation time
  PERFORM public.enforce_txn_limit(v_sender_id, p_type::text, p_amount);

  SELECT COUNT(*) INTO v_rate_count
  FROM transfer_rate_limits
  WHERE user_id = v_sender_id AND rpc_name = 'transfer_money' AND created_at > (now() - interval '1 hour');
  IF v_rate_count >= 10 THEN RAISE EXCEPTION 'Rate limit exceeded. Maximum 10 transfers per hour.'; END IF;
  INSERT INTO transfer_rate_limits (user_id, rpc_name) VALUES (v_sender_id, 'transfer_money');

  v_total_deduction := p_amount + p_fee;

  SELECT balance INTO v_sender_balance FROM profiles WHERE user_id = v_sender_id FOR UPDATE;
  IF v_sender_balance IS NULL THEN RAISE EXCEPTION 'Sender profile not found'; END IF;
  IF v_sender_balance < v_total_deduction THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  SELECT user_id, balance, name INTO v_recipient_profile FROM profiles WHERE phone = p_recipient_phone FOR UPDATE;

  IF v_recipient_profile.user_id IS NULL THEN RAISE EXCEPTION 'Recipient not found'; END IF;
  IF v_recipient_profile.user_id = v_sender_id THEN RAISE EXCEPTION 'Cannot transfer to yourself'; END IF;

  v_sender_new_balance := v_sender_balance - v_total_deduction;
  v_recipient_new_balance := v_recipient_profile.balance + p_amount + p_commission;

  UPDATE profiles SET balance = v_sender_new_balance WHERE user_id = v_sender_id;
  UPDATE profiles SET balance = v_recipient_new_balance WHERE user_id = v_recipient_profile.user_id;

  v_sender_txn_id := gen_random_uuid();
  v_recipient_txn_id := gen_random_uuid();

  INSERT INTO transactions (id, user_id, type, amount, fee, commission, balance_after, recipient_phone, recipient_name, description, reference, status)
  VALUES (v_sender_txn_id, v_sender_id, p_type, p_amount, p_fee, 0, v_sender_new_balance,
    p_recipient_phone, COALESCE(p_recipient_name, v_recipient_profile.name), p_description, p_reference, 'completed');

  INSERT INTO transactions (id, user_id, type, amount, fee, commission, balance_after, recipient_phone, recipient_name, description, reference, status)
  VALUES (v_recipient_txn_id, v_recipient_profile.user_id, p_recipient_type, p_amount, 0, p_commission, v_recipient_new_balance,
    (SELECT phone FROM profiles WHERE user_id = v_sender_id),
    (SELECT name FROM profiles WHERE user_id = v_sender_id),
    p_description, p_reference, 'completed');

  IF p_fee > 0 THEN
    SELECT * INTO v_treasury FROM platform_treasury LIMIT 1 FOR UPDATE;
    IF v_treasury.id IS NOT NULL THEN
      v_new_treasury_balance := v_treasury.balance + p_fee;
      UPDATE platform_treasury SET balance = v_new_treasury_balance, total_earnings = total_earnings + p_fee, updated_at = now() WHERE id = v_treasury.id;
      INSERT INTO treasury_ledger (type, amount, balance_after, counterparty_user_id, description, reference)
      VALUES ('earning', p_fee, v_new_treasury_balance, v_sender_id, 'Fee from ' || p_type::text || ' transfer', p_reference);
    END IF;
  END IF;

  IF p_commission > 0 THEN
    SELECT * INTO v_treasury FROM platform_treasury LIMIT 1 FOR UPDATE;
    IF v_treasury.id IS NOT NULL THEN
      v_new_treasury_balance := v_treasury.balance - p_commission;
      UPDATE platform_treasury SET balance = v_new_treasury_balance, total_commissions_paid = total_commissions_paid + p_commission, updated_at = now() WHERE id = v_treasury.id;
      INSERT INTO treasury_ledger (type, amount, balance_after, counterparty_user_id, counterparty_role, description, reference)
      VALUES ('commission_paid', p_commission, v_new_treasury_balance, v_recipient_profile.user_id, 'agent', 'Commission for ' || p_type::text, p_reference);
    END IF;
  END IF;

  -- EasyPay Club points accrual (Send Money and other configured types)
  BEGIN
    PERFORM public.award_loyalty_points(v_sender_id, p_type::text, p_amount, v_sender_txn_id);
  EXCEPTION WHEN OTHERS THEN
    NULL; -- never fail a transfer because of points
  END;

  RETURN json_build_object('success', true, 'sender_balance', v_sender_new_balance, 'recipient_found', true, 'reference', p_reference);
END;
$function$;