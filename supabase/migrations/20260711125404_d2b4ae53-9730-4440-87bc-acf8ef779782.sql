
INSERT INTO public.payment_gateways (provider, display_name, is_enabled, sort_order, config)
VALUES (
  'uddoktapay',
  'UddoktaPay',
  true,
  100,
  jsonb_build_object('UDDOKTAPAY_API_KEY', '', 'UDDOKTAPAY_BASE_URL', 'https://easypay.paymently.io/api')
)
ON CONFLICT (provider) DO NOTHING;

CREATE OR REPLACE FUNCTION public.system_approve_addmoney_request(
  p_request_id uuid,
  p_gateway_ref text
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req RECORD;
  v_balance NUMERIC;
  v_new_balance NUMERIC;
  v_treasury RECORD;
  v_new_treasury_balance NUMERIC;
BEGIN
  SELECT * INTO v_req FROM fund_requests WHERE id = p_request_id FOR UPDATE;
  IF v_req.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_req.status <> 'pending' THEN
    RETURN json_build_object('success', true, 'already', true);
  END IF;
  IF v_req.type <> 'add_money' THEN RAISE EXCEPTION 'Not an add_money request'; END IF;

  SELECT balance INTO v_balance FROM profiles WHERE user_id = v_req.user_id FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'User profile not found'; END IF;

  v_new_balance := v_balance + v_req.amount;
  UPDATE profiles SET balance = v_new_balance WHERE user_id = v_req.user_id;

  IF v_req.transaction_id IS NOT NULL THEN
    UPDATE transactions SET status = 'completed', balance_after = v_new_balance WHERE id = v_req.transaction_id;
  ELSE
    INSERT INTO transactions (user_id, type, amount, fee, balance_after, description, reference, status)
    VALUES (v_req.user_id, 'addmoney', v_req.amount, 0, v_new_balance,
      'Add Money via UddoktaPay', p_gateway_ref, 'completed');
  END IF;

  SELECT * INTO v_treasury FROM platform_treasury LIMIT 1 FOR UPDATE;
  IF v_treasury.id IS NOT NULL THEN
    v_new_treasury_balance := v_treasury.balance - v_req.amount;
    UPDATE platform_treasury SET balance = v_new_treasury_balance, updated_at = now() WHERE id = v_treasury.id;
    INSERT INTO treasury_ledger (type, amount, balance_after, counterparty_user_id, description)
    VALUES ('user_addmoney', v_req.amount, v_new_treasury_balance, v_req.user_id, 'UddoktaPay add money auto-approved');
  END IF;

  UPDATE fund_requests
     SET status = 'approved',
         admin_note = COALESCE(admin_note, '') || ' [uddoktapay:' || p_gateway_ref || ']',
         reviewed_at = now(),
         transaction_id_proof = COALESCE(transaction_id_proof, p_gateway_ref),
         updated_at = now()
   WHERE id = p_request_id;

  INSERT INTO notifications (user_id, title, body, category, metadata)
  VALUES (v_req.user_id,
    '৳' || v_req.amount || ' Added to Wallet',
    'Your UddoktaPay payment of ৳' || v_req.amount || ' has been received.',
    'transaction',
    jsonb_build_object('request_id', p_request_id, 'type', 'add_money', 'amount', v_req.amount, 'gateway', 'uddoktapay'));

  RETURN json_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

REVOKE ALL ON FUNCTION public.system_approve_addmoney_request(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.system_approve_addmoney_request(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.system_approve_addmoney_request(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.system_approve_addmoney_request(uuid, text) TO service_role;
