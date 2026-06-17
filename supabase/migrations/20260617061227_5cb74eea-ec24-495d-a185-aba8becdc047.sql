
-- =========================================================
-- 1. Lock down direct writes on financial tables
-- =========================================================

-- transactions
DROP POLICY IF EXISTS "Users can create own transactions" ON public.transactions;

-- savings_deposits
DROP POLICY IF EXISTS "savings_deposits_own_insert" ON public.savings_deposits;
DROP POLICY IF EXISTS "savings_deposits_own_delete" ON public.savings_deposits;

-- savings_goals: drop blanket ALL and per-cmd writes; keep selects.
DROP POLICY IF EXISTS "Users manage own savings goals" ON public.savings_goals;
DROP POLICY IF EXISTS "savings_goals_own_insert" ON public.savings_goals;
DROP POLICY IF EXISTS "savings_goals_own_update" ON public.savings_goals;
DROP POLICY IF EXISTS "savings_goals_own_delete" ON public.savings_goals;
-- Re-add user SELECT (the "Users manage own savings goals" ALL policy covered it).
DROP POLICY IF EXISTS "Users read own savings goals" ON public.savings_goals;
CREATE POLICY "Users read own savings goals"
  ON public.savings_goals FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
-- Allow admins to manage savings goals (used by admin UI).
DROP POLICY IF EXISTS "Admins manage savings goals" ON public.savings_goals;
CREATE POLICY "Admins manage savings goals"
  ON public.savings_goals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- gold_holdings
DROP POLICY IF EXISTS "Users manage own gold holdings" ON public.gold_holdings;
DROP POLICY IF EXISTS "gold_holdings_own_insert" ON public.gold_holdings;
DROP POLICY IF EXISTS "gold_holdings_own_update" ON public.gold_holdings;
DROP POLICY IF EXISTS "gold_holdings_own_delete" ON public.gold_holdings;

-- stock_holdings
DROP POLICY IF EXISTS "Users manage own stock holdings" ON public.stock_holdings;
DROP POLICY IF EXISTS "stock_holdings_own_insert" ON public.stock_holdings;
DROP POLICY IF EXISTS "stock_holdings_own_update" ON public.stock_holdings;
DROP POLICY IF EXISTS "stock_holdings_own_delete" ON public.stock_holdings;

-- dps_missed_payments: remove user write paths; repayment must use repay_missed_dps RPC.
DROP POLICY IF EXISTS "Users manage own missed payments" ON public.dps_missed_payments;
DROP POLICY IF EXISTS "dps_missed_payments_own_insert" ON public.dps_missed_payments;
DROP POLICY IF EXISTS "dps_missed_payments_own_update" ON public.dps_missed_payments;
DROP POLICY IF EXISTS "dps_missed_payments_own_delete" ON public.dps_missed_payments;

-- dps_run_log: audit trail — no user writes.
DROP POLICY IF EXISTS "dps_run_log_own_insert" ON public.dps_run_log;
DROP POLICY IF EXISTS "dps_run_log_own_delete" ON public.dps_run_log;

-- =========================================================
-- 2. Atomic balance helpers (no read-then-write race)
-- =========================================================
CREATE OR REPLACE FUNCTION public.credit_user_balance(
  p_user_id uuid,
  p_amount  numeric
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'credit_user_balance: amount must be positive';
  END IF;

  UPDATE public.profiles
     SET balance = COALESCE(balance, 0) + p_amount
   WHERE user_id = p_user_id
   RETURNING balance INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    RAISE EXCEPTION 'credit_user_balance: profile not found for %', p_user_id;
  END IF;

  RETURN v_new_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_user_balance(uuid, numeric) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_user_balance(uuid, numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.debit_user_balance(
  p_user_id uuid,
  p_amount  numeric
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'debit_user_balance: amount must be positive';
  END IF;

  UPDATE public.profiles
     SET balance = balance - p_amount
   WHERE user_id = p_user_id
     AND COALESCE(balance, 0) >= p_amount
   RETURNING balance INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    RAISE EXCEPTION 'debit_user_balance: insufficient funds or profile missing for %', p_user_id;
  END IF;

  RETURN v_new_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.debit_user_balance(uuid, numeric) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.debit_user_balance(uuid, numeric) TO service_role;

-- =========================================================
-- 3. Tighten realtime allow-list: remove shared sensitive channels
-- =========================================================
DROP POLICY IF EXISTS "scoped_realtime_subscribe" ON realtime.messages;

CREATE POLICY "scoped_realtime_subscribe"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE '%' || auth.uid()::text || '%'
  OR realtime.topic() = 'online-users'
  OR realtime.topic() = 'chat-realtime-combined'
  OR realtime.topic() LIKE 'typing:%'
  OR realtime.topic() LIKE 'qr-session-%'
  OR realtime.topic() LIKE 'fund-request-%'
  OR realtime.topic() LIKE 'ai-rewards-%'
  OR realtime.topic() IN (
    'fee-config-realtime','recharge-packs-user','shop-page-products-rt',
    'referral-updates','payment_links_realtime'
  )
  OR (
    (realtime.topic() LIKE 'admin-%'
      OR realtime.topic() LIKE 'sd-%'
      OR realtime.topic() LIKE 'dist-%'
      OR realtime.topic() LIKE 'merchant-realtime%')
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'risk'::public.app_role)
      OR public.has_role(auth.uid(), 'compliance'::public.app_role)
      OR public.has_role(auth.uid(), 'operations'::public.app_role)
      OR public.has_role(auth.uid(), 'support'::public.app_role)
      OR public.has_role(auth.uid(), 'super_distributor'::public.app_role)
      OR public.has_role(auth.uid(), 'distributor'::public.app_role)
      OR public.has_role(auth.uid(), 'merchant'::public.app_role)
    )
  )
);
