
-- Block 'addmoney' type from being called by regular (non-admin) users in record_transaction RPC
CREATE OR REPLACE FUNCTION public.record_transaction(p_type txn_type, p_amount numeric, p_fee numeric DEFAULT 0, p_recipient_phone text DEFAULT NULL::text, p_recipient_name text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_reference text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_balance NUMERIC;
  v_new_balance NUMERIC;
  v_total_deduction NUMERIC;
  v_rate_count INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- SECURITY: Block 'addmoney' type from client-side calls.
  -- Only admins can credit balances via this RPC. All legitimate add-money
  -- operations must go through verified payment gateway webhooks.
  IF p_type = 'addmoney' THEN
    IF NOT has_role(v_user_id, 'admin') THEN
      RAISE EXCEPTION 'Add money transactions are not allowed from client. Use a verified payment gateway.';
    END IF;
  END IF;

  -- Input validation
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF p_amount > 1000000 THEN RAISE EXCEPTION 'Amount exceeds maximum limit'; END IF;
  IF p_fee IS NULL OR p_fee < 0 THEN RAISE EXCEPTION 'Fee cannot be negative'; END IF;
  IF p_fee > p_amount THEN RAISE EXCEPTION 'Fee cannot exceed amount'; END IF;
  IF p_description IS NOT NULL AND LENGTH(p_description) > 500 THEN RAISE EXCEPTION 'Description too long'; END IF;
  IF p_reference IS NOT NULL AND LENGTH(p_reference) > 100 THEN RAISE EXCEPTION 'Reference too long'; END IF;
  IF p_recipient_phone IS NOT NULL AND p_recipient_phone !~ '^[0-9A-Za-z\-]{3,20}$' THEN RAISE EXCEPTION 'Invalid recipient identifier'; END IF;

  -- Rate limiting: max 10 transactions per hour
  SELECT COUNT(*) INTO v_rate_count
  FROM transfer_rate_limits
  WHERE user_id = v_user_id
    AND rpc_name = 'record_transaction'
    AND created_at > (now() - interval '1 hour');

  IF v_rate_count >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded. Maximum 10 transactions per hour.';
  END IF;

  -- Record for rate limiting
  INSERT INTO transfer_rate_limits (user_id, rpc_name) VALUES (v_user_id, 'record_transaction');

  SELECT balance INTO v_balance FROM profiles WHERE user_id = v_user_id FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;

  IF p_type = 'addmoney' THEN
    v_new_balance := v_balance + p_amount;
  ELSE
    v_total_deduction := p_amount + p_fee;
    IF v_balance < v_total_deduction THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
    v_new_balance := v_balance - v_total_deduction;
  END IF;

  UPDATE profiles SET balance = v_new_balance WHERE user_id = v_user_id;

  INSERT INTO transactions (user_id, type, amount, fee, balance_after, recipient_phone, recipient_name, description, reference, status)
  VALUES (v_user_id, p_type, p_amount, p_fee, v_new_balance, p_recipient_phone, p_recipient_name, p_description, p_reference, 'completed');

  RETURN json_build_object('success', true, 'balance', v_new_balance);
END;
$function$;
