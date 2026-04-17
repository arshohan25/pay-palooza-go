-- 1. Goals: payout metadata
ALTER TABLE public.savings_goals
  ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz,
  ADD COLUMN IF NOT EXISTS withdrawn_amount numeric(14,2);

-- 2. Loans: track partial repayments
ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS repaid_amount numeric(14,2) NOT NULL DEFAULT 0;

-- 3. Update withdraw_completed_goal to record payout date + amount
CREATE OR REPLACE FUNCTION public.withdraw_completed_goal(p_goal_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_goal record;
  v_user uuid;
  v_payout numeric;
  v_new_balance numeric;
  v_txn_id uuid;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_goal FROM savings_goals WHERE id = p_goal_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Goal not found'; END IF;
  IF v_goal.status = 'withdrawn' THEN RAISE EXCEPTION 'Goal already withdrawn'; END IF;
  IF v_goal.saved_amount <= 0 THEN RAISE EXCEPTION 'No funds to withdraw'; END IF;

  v_payout := v_goal.saved_amount;

  UPDATE profiles SET balance = balance + v_payout WHERE id = v_user
  RETURNING balance INTO v_new_balance;

  UPDATE savings_goals
     SET status = 'withdrawn',
         withdrawn_at = now(),
         withdrawn_amount = v_payout,
         updated_at = now()
   WHERE id = p_goal_id;

  INSERT INTO transactions (user_id, type, amount, description, status, balance_after, reference)
  VALUES (v_user, 'addmoney', v_payout, 'Goal Withdrawal: ' || v_goal.name, 'completed', v_new_balance, 'GOAL-WD-' || p_goal_id::text)
  RETURNING id INTO v_txn_id;

  RETURN json_build_object('success', true, 'payout', v_payout, 'new_balance', v_new_balance, 'txn_id', v_txn_id);
END;
$function$;

-- 4. Partial loan repayment RPC
CREATE OR REPLACE FUNCTION public.repay_loan_partial(p_loan_id uuid, p_amount numeric)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_loan record;
  v_user uuid;
  v_total_due numeric;
  v_outstanding numeric;
  v_pay numeric;
  v_new_balance numeric;
  v_new_status text;
  v_fee numeric;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  SELECT * INTO v_loan FROM loan_applications
   WHERE id = p_loan_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Loan not found'; END IF;
  IF v_loan.status <> 'disbursed' THEN RAISE EXCEPTION 'Loan must be active to repay'; END IF;

  v_fee := v_loan.amount * (COALESCE(v_loan.interest_rate, 3) / 100.0);
  v_total_due := v_loan.amount + v_fee;
  v_outstanding := GREATEST(0, v_total_due - COALESCE(v_loan.repaid_amount, 0));
  IF v_outstanding <= 0 THEN RAISE EXCEPTION 'Loan is already fully repaid'; END IF;

  v_pay := LEAST(p_amount, v_outstanding);

  UPDATE profiles SET balance = balance - v_pay
   WHERE id = v_user AND balance >= v_pay
   RETURNING balance INTO v_new_balance;
  IF v_new_balance IS NULL THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  v_new_status := CASE WHEN (COALESCE(v_loan.repaid_amount, 0) + v_pay) >= v_total_due THEN 'repaid' ELSE 'disbursed' END;

  UPDATE loan_applications
     SET repaid_amount = COALESCE(repaid_amount, 0) + v_pay,
         status = v_new_status,
         updated_at = now()
   WHERE id = p_loan_id;

  INSERT INTO transactions (user_id, type, amount, description, status, balance_after, reference)
  VALUES (
    v_user, 'payment', v_pay,
    CASE WHEN v_new_status = 'repaid' THEN 'Loan Repayment: full settlement' ELSE 'Loan Repayment: ৳' || v_pay::text || ' (partial)' END,
    'completed', v_new_balance, 'LOAN-' || p_loan_id::text
  );

  RETURN json_build_object(
    'success', true,
    'paid', v_pay,
    'outstanding', GREATEST(0, v_total_due - (COALESCE(v_loan.repaid_amount, 0) + v_pay)),
    'new_balance', v_new_balance,
    'status', v_new_status
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.repay_loan_partial(uuid, numeric) TO authenticated;