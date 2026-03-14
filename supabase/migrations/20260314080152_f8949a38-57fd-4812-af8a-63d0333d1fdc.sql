
-- 1. Add transaction_id column to fund_requests
ALTER TABLE public.fund_requests ADD COLUMN IF NOT EXISTS transaction_id uuid REFERENCES public.transactions(id);

-- 2. New RPC: submit_withdraw_request (instant deduction)
CREATE OR REPLACE FUNCTION public.submit_withdraw_request(
  p_amount numeric,
  p_bank_name text,
  p_account_number text,
  p_account_holder text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_balance NUMERIC;
  v_fee NUMERIC;
  v_total_deduction NUMERIC;
  v_new_balance NUMERIC;
  v_txn_id UUID;
  v_req_id UUID;
  v_rate_count INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF p_amount < 30 THEN RAISE EXCEPTION 'Minimum withdrawal is 30'; END IF;
  IF p_amount > 50000 THEN RAISE EXCEPTION 'Maximum withdrawal is 50000'; END IF;
  IF p_bank_name IS NULL OR LENGTH(TRIM(p_bank_name)) < 2 THEN RAISE EXCEPTION 'Bank name is required'; END IF;
  IF p_account_number IS NULL OR LENGTH(TRIM(p_account_number)) < 8 THEN RAISE EXCEPTION 'Valid account number is required'; END IF;
  IF p_account_holder IS NULL OR LENGTH(TRIM(p_account_holder)) < 2 THEN RAISE EXCEPTION 'Account holder name is required'; END IF;

  SELECT COUNT(*) INTO v_rate_count
  FROM transfer_rate_limits
  WHERE user_id = v_user_id AND rpc_name = 'submit_withdraw_request' AND created_at > (now() - interval '1 hour');
  IF v_rate_count >= 5 THEN RAISE EXCEPTION 'Rate limit exceeded. Maximum 5 withdrawal requests per hour.'; END IF;
  INSERT INTO transfer_rate_limits (user_id, rpc_name) VALUES (v_user_id, 'submit_withdraw_request');

  v_fee := ROUND(p_amount * 0.01, 2);
  v_total_deduction := p_amount + v_fee;

  SELECT balance INTO v_balance FROM profiles WHERE user_id = v_user_id FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF v_balance < v_total_deduction THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  v_new_balance := v_balance - v_total_deduction;
  UPDATE profiles SET balance = v_new_balance WHERE user_id = v_user_id;

  v_txn_id := gen_random_uuid();
  INSERT INTO transactions (id, user_id, type, amount, fee, balance_after, description, reference, status, recipient_name)
  VALUES (v_txn_id, v_user_id, 'banktransfer', p_amount, v_fee, v_new_balance,
    'Withdrawal to ' || p_bank_name || ' ' || p_account_number,
    NULL, 'pending', p_account_holder);

  v_req_id := gen_random_uuid();
  INSERT INTO fund_requests (id, user_id, type, amount, source_method, bank_name, account_number, account_holder, transaction_id)
  VALUES (v_req_id, v_user_id, 'withdraw', p_amount, 'bank_transfer', p_bank_name, p_account_number, p_account_holder, v_txn_id);

  RETURN json_build_object(
    'success', true,
    'request_id', v_req_id,
    'transaction_id', v_txn_id,
    'amount', p_amount,
    'fee', v_fee,
    'total_deducted', v_total_deduction,
    'new_balance', v_new_balance
  );
END;
$$;

-- 3. Updated admin_approve_fund_request
CREATE OR REPLACE FUNCTION public.admin_approve_fund_request(p_request_id uuid, p_admin_note text DEFAULT NULL::text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin_id UUID;
  v_req RECORD;
  v_balance NUMERIC;
  v_new_balance NUMERIC;
  v_treasury RECORD;
  v_new_treasury_balance NUMERIC;
  v_fee NUMERIC;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL OR NOT has_role(v_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  SELECT * INTO v_req FROM fund_requests WHERE id = p_request_id FOR UPDATE;
  IF v_req.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_req.status != 'pending' THEN RAISE EXCEPTION 'Request already processed'; END IF;

  SELECT balance INTO v_balance FROM profiles WHERE user_id = v_req.user_id FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'User profile not found'; END IF;

  IF v_req.type = 'add_money' THEN
    v_new_balance := v_balance + v_req.amount;
    UPDATE profiles SET balance = v_new_balance WHERE user_id = v_req.user_id;

    INSERT INTO transactions (user_id, type, amount, fee, balance_after, description, reference, status)
    VALUES (v_req.user_id, 'addmoney', v_req.amount, 0, v_new_balance,
      'Add Money (Manual) via ' || COALESCE(v_req.source_method, 'unknown'),
      v_req.transaction_id_proof, 'completed');

    SELECT * INTO v_treasury FROM platform_treasury LIMIT 1 FOR UPDATE;
    IF v_treasury.id IS NOT NULL THEN
      v_new_treasury_balance := v_treasury.balance - v_req.amount;
      UPDATE platform_treasury SET balance = v_new_treasury_balance, updated_at = now() WHERE id = v_treasury.id;
      INSERT INTO treasury_ledger (type, amount, balance_after, counterparty_user_id, description)
      VALUES ('user_addmoney', v_req.amount, v_new_treasury_balance, v_req.user_id, 'Manual add money approved');
    END IF;

  ELSIF v_req.type = 'withdraw' THEN
    IF v_req.transaction_id IS NOT NULL THEN
      SELECT fee INTO v_fee FROM transactions WHERE id = v_req.transaction_id;
      UPDATE transactions SET status = 'completed' WHERE id = v_req.transaction_id;
    END IF;

    v_new_balance := v_balance;

    SELECT * INTO v_treasury FROM platform_treasury LIMIT 1 FOR UPDATE;
    IF v_treasury.id IS NOT NULL THEN
      v_new_treasury_balance := v_treasury.balance + v_req.amount + COALESCE(v_fee, 0);
      UPDATE platform_treasury SET balance = v_new_treasury_balance, total_earnings = total_earnings + COALESCE(v_fee, 0), updated_at = now() WHERE id = v_treasury.id;
      INSERT INTO treasury_ledger (type, amount, balance_after, counterparty_user_id, description)
      VALUES ('earning', v_req.amount + COALESCE(v_fee, 0), v_new_treasury_balance, v_req.user_id, 'User withdrawal approved (amount + fee)');
    END IF;
  END IF;

  UPDATE fund_requests SET status = 'approved', admin_note = p_admin_note, reviewed_by = v_admin_id, reviewed_at = now(), updated_at = now()
  WHERE id = p_request_id;

  INSERT INTO notifications (user_id, title, body, category, metadata)
  VALUES (v_req.user_id,
    CASE WHEN v_req.type = 'add_money' THEN '৳' || v_req.amount || ' Added to Wallet' ELSE 'Withdrawal ৳' || v_req.amount || ' Processed' END,
    CASE WHEN v_req.type = 'add_money' THEN 'Your add money request of ৳' || v_req.amount || ' has been approved.' ELSE 'Your withdrawal of ৳' || v_req.amount || ' has been processed and sent to your bank.' END,
    'transaction',
    jsonb_build_object('request_id', p_request_id, 'type', v_req.type, 'amount', v_req.amount));

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (v_admin_id, 'fund_request_approved', 'fund_request', p_request_id,
    jsonb_build_object('type', v_req.type, 'amount', v_req.amount, 'user_id', v_req.user_id, 'new_balance', v_new_balance));

  RETURN json_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

-- 4. Updated admin_reject_fund_request: refund for withdrawals
CREATE OR REPLACE FUNCTION public.admin_reject_fund_request(p_request_id uuid, p_admin_note text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin_id UUID;
  v_req RECORD;
  v_balance NUMERIC;
  v_new_balance NUMERIC;
  v_fee NUMERIC;
  v_refund_total NUMERIC;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL OR NOT has_role(v_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  IF p_admin_note IS NULL OR LENGTH(TRIM(p_admin_note)) < 3 THEN
    RAISE EXCEPTION 'Rejection reason is required (min 3 characters)';
  END IF;

  SELECT * INTO v_req FROM fund_requests WHERE id = p_request_id FOR UPDATE;
  IF v_req.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_req.status != 'pending' THEN RAISE EXCEPTION 'Request already processed'; END IF;

  IF v_req.type = 'withdraw' AND v_req.transaction_id IS NOT NULL THEN
    SELECT fee INTO v_fee FROM transactions WHERE id = v_req.transaction_id;
    v_refund_total := v_req.amount + COALESCE(v_fee, 0);

    UPDATE transactions SET status = 'rejected' WHERE id = v_req.transaction_id;

    SELECT balance INTO v_balance FROM profiles WHERE user_id = v_req.user_id FOR UPDATE;
    v_new_balance := v_balance + v_refund_total;
    UPDATE profiles SET balance = v_new_balance WHERE user_id = v_req.user_id;

    INSERT INTO transactions (user_id, type, amount, fee, balance_after, description, reference, status)
    VALUES (v_req.user_id, 'addmoney', v_refund_total, 0, v_new_balance,
      'Refund: Withdrawal rejected - ' || p_admin_note,
      v_req.transaction_id::text, 'completed');
  END IF;

  UPDATE fund_requests SET status = 'rejected', admin_note = p_admin_note, reviewed_by = v_admin_id, reviewed_at = now(), updated_at = now()
  WHERE id = p_request_id;

  INSERT INTO notifications (user_id, title, body, category, metadata)
  VALUES (v_req.user_id,
    CASE WHEN v_req.type = 'add_money' THEN 'Add Money Request Rejected' ELSE 'Withdrawal Rejected - Funds Refunded' END,
    CASE WHEN v_req.type = 'add_money' THEN 'Your request of ৳' || v_req.amount || ' was rejected: ' || p_admin_note
      ELSE 'Your withdrawal of ৳' || v_req.amount || ' was rejected. ৳' || v_refund_total || ' (including fee) has been refunded to your wallet.' END,
    'transaction',
    jsonb_build_object('request_id', p_request_id, 'type', v_req.type, 'amount', v_req.amount, 'reason', p_admin_note));

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (v_admin_id, 'fund_request_rejected', 'fund_request', p_request_id,
    jsonb_build_object('type', v_req.type, 'amount', v_req.amount, 'user_id', v_req.user_id, 'reason', p_admin_note,
      'refunded', CASE WHEN v_req.type = 'withdraw' THEN v_refund_total ELSE 0 END));

  RETURN json_build_object('success', true);
END;
$$;
