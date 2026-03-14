-- New RPC: submit_addmoney_request
CREATE OR REPLACE FUNCTION public.submit_addmoney_request(
  p_amount NUMERIC,
  p_source_method TEXT DEFAULT NULL,
  p_proof_url TEXT DEFAULT NULL,
  p_transaction_id_proof TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_balance NUMERIC;
  v_txn_id UUID;
  v_req_id UUID;
  v_rate_count INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF p_amount < 10 THEN RAISE EXCEPTION 'Minimum is 10'; END IF;
  IF p_amount > 100000 THEN RAISE EXCEPTION 'Maximum is 100000'; END IF;

  SELECT COUNT(*) INTO v_rate_count
  FROM transfer_rate_limits
  WHERE user_id = v_user_id AND rpc_name = 'submit_addmoney_request' AND created_at > (now() - interval '1 hour');
  IF v_rate_count >= 5 THEN RAISE EXCEPTION 'Rate limit exceeded. Maximum 5 requests per hour.'; END IF;
  INSERT INTO transfer_rate_limits (user_id, rpc_name) VALUES (v_user_id, 'submit_addmoney_request');

  SELECT balance INTO v_balance FROM profiles WHERE user_id = v_user_id;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;

  v_txn_id := gen_random_uuid();
  INSERT INTO transactions (id, user_id, type, amount, fee, balance_after, description, reference, status)
  VALUES (v_txn_id, v_user_id, 'addmoney', p_amount, 0, v_balance,
    'Add Money (Manual) via ' || COALESCE(p_source_method, 'unknown'),
    p_transaction_id_proof, 'pending');

  v_req_id := gen_random_uuid();
  INSERT INTO fund_requests (id, user_id, type, amount, source_method, proof_url, transaction_id_proof, transaction_id)
  VALUES (v_req_id, v_user_id, 'add_money', p_amount, p_source_method, p_proof_url, p_transaction_id_proof, v_txn_id);

  RETURN json_build_object(
    'success', true,
    'request_id', v_req_id,
    'transaction_id', v_txn_id,
    'amount', p_amount
  );
END;
$$;

-- Update admin_approve_fund_request to handle existing transaction for add_money
CREATE OR REPLACE FUNCTION public.admin_approve_fund_request(p_request_id UUID, p_admin_note TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

    IF v_req.transaction_id IS NOT NULL THEN
      UPDATE transactions SET status = 'completed', balance_after = v_new_balance WHERE id = v_req.transaction_id;
    ELSE
      INSERT INTO transactions (user_id, type, amount, fee, balance_after, description, reference, status)
      VALUES (v_req.user_id, 'addmoney', v_req.amount, 0, v_new_balance,
        'Add Money (Manual) via ' || COALESCE(v_req.source_method, 'unknown'),
        v_req.transaction_id_proof, 'completed');
    END IF;

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

-- Update admin_reject_fund_request to handle add_money rejection
CREATE OR REPLACE FUNCTION public.admin_reject_fund_request(p_request_id UUID, p_admin_note TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  IF v_req.type = 'withdraw' THEN
    SELECT balance INTO v_balance FROM profiles WHERE user_id = v_req.user_id FOR UPDATE;
    IF v_balance IS NULL THEN RAISE EXCEPTION 'User profile not found'; END IF;

    v_fee := 0;
    IF v_req.transaction_id IS NOT NULL THEN
      SELECT fee INTO v_fee FROM transactions WHERE id = v_req.transaction_id;
      UPDATE transactions SET status = 'failed' WHERE id = v_req.transaction_id;
    END IF;

    v_refund_total := v_req.amount + COALESCE(v_fee, 0);
    v_new_balance := v_balance + v_refund_total;
    UPDATE profiles SET balance = v_new_balance WHERE user_id = v_req.user_id;

  ELSIF v_req.type = 'add_money' THEN
    IF v_req.transaction_id IS NOT NULL THEN
      UPDATE transactions SET status = 'failed' WHERE id = v_req.transaction_id;
    END IF;
    SELECT balance INTO v_new_balance FROM profiles WHERE user_id = v_req.user_id;
  END IF;

  UPDATE fund_requests SET status = 'rejected', admin_note = p_admin_note, reviewed_by = v_admin_id, reviewed_at = now(), updated_at = now()
  WHERE id = p_request_id;

  INSERT INTO notifications (user_id, title, body, category, metadata)
  VALUES (v_req.user_id,
    CASE WHEN v_req.type = 'add_money' THEN 'Add Money Request Rejected' ELSE 'Withdrawal Request Rejected' END,
    'Your ' || CASE WHEN v_req.type = 'add_money' THEN 'add money' ELSE 'withdrawal' END || ' request of ৳' || v_req.amount || ' was rejected. Reason: ' || p_admin_note,
    'transaction',
    jsonb_build_object('request_id', p_request_id, 'type', v_req.type, 'amount', v_req.amount));

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (v_admin_id, 'fund_request_rejected', 'fund_request', p_request_id,
    jsonb_build_object('type', v_req.type, 'amount', v_req.amount, 'user_id', v_req.user_id, 'reason', p_admin_note));

  RETURN json_build_object('success', true, 'new_balance', COALESCE(v_new_balance, 0));
END;
$$;
