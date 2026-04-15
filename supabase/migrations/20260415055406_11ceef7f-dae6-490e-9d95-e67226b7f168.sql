
CREATE OR REPLACE FUNCTION public.disburse_loan(p_loan_id uuid, p_admin_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loan record;
  v_fee numeric;
  v_net numeric;
BEGIN
  SELECT * INTO v_loan FROM loan_applications WHERE id = p_loan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Loan not found'; END IF;
  IF v_loan.status <> 'approved' THEN RAISE EXCEPTION 'Loan must be in approved status to disburse'; END IF;

  v_fee := v_loan.amount * 0.03;
  v_net := v_loan.amount - v_fee;

  UPDATE loan_applications SET status = 'disbursed', reviewed_by = p_admin_id, reviewed_at = now(), updated_at = now() WHERE id = p_loan_id;

  UPDATE profiles SET balance = balance + v_net WHERE id = v_loan.user_id;

  -- Fee record
  INSERT INTO transactions (user_id, type, amount, description, status, reference_id)
  VALUES (v_loan.user_id, 'payment', v_fee, 'Loan Processing Fee (3%)', 'completed', p_loan_id::text);

  -- Net disbursement record
  INSERT INTO transactions (user_id, type, amount, description, status, reference_id)
  VALUES (v_loan.user_id, 'addmoney', v_net, 'Qard Hasan Disbursement (after fee)', 'completed', p_loan_id::text);
END;
$$;

CREATE OR REPLACE FUNCTION public.repay_loan(p_loan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loan record;
  v_total numeric;
BEGIN
  SELECT * INTO v_loan FROM loan_applications WHERE id = p_loan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Loan not found'; END IF;
  IF v_loan.status <> 'disbursed' THEN RAISE EXCEPTION 'Loan must be in disbursed status to repay'; END IF;

  v_total := v_loan.amount;

  UPDATE profiles SET balance = balance - v_total WHERE id = v_loan.user_id AND balance >= v_total;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient balance for repayment'; END IF;

  UPDATE loan_applications SET status = 'repaid', updated_at = now() WHERE id = p_loan_id;

  INSERT INTO transactions (user_id, type, amount, description, status, reference_id)
  VALUES (v_loan.user_id, 'payment', v_total, 'Qard Hasan Repayment', 'completed', p_loan_id::text);
END;
$$;
