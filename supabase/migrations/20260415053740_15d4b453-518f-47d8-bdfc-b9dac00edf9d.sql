
-- RPC: apply_loan
CREATE OR REPLACE FUNCTION public.apply_loan(
  p_amount numeric,
  p_tenure_days integer,
  p_interest_rate numeric,
  p_emi_amount numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_loan_id uuid;
  v_txn_id uuid := gen_random_uuid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  INSERT INTO loan_applications (user_id, amount, tenure_days, interest_rate, emi_amount, status)
  VALUES (v_user_id, p_amount, p_tenure_days, p_interest_rate, p_emi_amount, 'pending')
  RETURNING id INTO v_loan_id;

  INSERT INTO transactions (id, user_id, type, amount, description, reference_id, status)
  VALUES (v_txn_id, v_user_id, 'payment', 0, 'Loan Application Submitted – ৳' || p_amount::text, v_loan_id::text, 'pending');

  RETURN v_loan_id;
END;
$$;

-- RPC: disburse_loan
CREATE OR REPLACE FUNCTION public.disburse_loan(
  p_loan_id uuid,
  p_admin_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loan record;
  v_txn_id uuid := gen_random_uuid();
BEGIN
  SELECT * INTO v_loan FROM loan_applications WHERE id = p_loan_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Loan not found'; END IF;
  IF v_loan.status != 'approved' THEN RAISE EXCEPTION 'Loan must be approved before disbursement'; END IF;

  UPDATE loan_applications SET status = 'disbursed', reviewed_by = p_admin_id, reviewed_at = now() WHERE id = p_loan_id;
  UPDATE profiles SET balance = balance + v_loan.amount WHERE user_id = v_loan.user_id;

  INSERT INTO transactions (id, user_id, type, amount, description, reference_id, status)
  VALUES (v_txn_id, v_loan.user_id, 'addmoney', v_loan.amount, 'Qard Hasan Disbursement', p_loan_id::text, 'completed');
END;
$$;

-- RPC: repay_loan
CREATE OR REPLACE FUNCTION public.repay_loan(p_loan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loan record;
  v_user_balance numeric;
  v_total numeric;
  v_txn_id uuid := gen_random_uuid();
BEGIN
  SELECT * INTO v_loan FROM loan_applications WHERE id = p_loan_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Loan not found'; END IF;
  IF v_loan.status != 'disbursed' THEN RAISE EXCEPTION 'Loan must be disbursed before repayment'; END IF;

  v_total := v_loan.emi_amount;

  SELECT balance INTO v_user_balance FROM profiles WHERE user_id = v_loan.user_id FOR UPDATE;
  IF v_user_balance < v_total THEN RAISE EXCEPTION 'Insufficient balance for repayment'; END IF;

  UPDATE profiles SET balance = balance - v_total WHERE user_id = v_loan.user_id;
  UPDATE loan_applications SET status = 'repaid' WHERE id = p_loan_id;

  INSERT INTO transactions (id, user_id, type, amount, description, reference_id, status)
  VALUES (v_txn_id, v_loan.user_id, 'payment', v_total, 'Qard Hasan Repayment', p_loan_id::text, 'completed');
END;
$$;
