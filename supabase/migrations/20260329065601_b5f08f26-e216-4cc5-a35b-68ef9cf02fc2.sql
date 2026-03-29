
-- 1. Reusable KYC helper
CREATE OR REPLACE FUNCTION public.require_kyc_verified(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM profiles WHERE user_id = p_user_id AND kyc_exempt = true) THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM kyc_verifications WHERE user_id = p_user_id AND status = 'verified') THEN
    RETURN;
  END IF;
  RAISE EXCEPTION 'KYC verification required to perform transactions';
END;
$$;

-- 2. Update record_transaction: add KYC check after auth
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
  v_treasury RECORD;
  v_new_treasury_balance NUMERIC;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  PERFORM require_kyc_verified(v_user_id);

  IF p_type = 'addmoney' THEN
    IF NOT has_role(v_user_id, 'admin') THEN
      RAISE EXCEPTION 'Add money transactions are not allowed from client. Use a verified payment gateway.';
    END IF;
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF p_amount > 1000000 THEN RAISE EXCEPTION 'Amount exceeds maximum limit'; END IF;
  IF p_fee IS NULL OR p_fee < 0 THEN RAISE EXCEPTION 'Fee cannot be negative'; END IF;
  IF p_fee > p_amount THEN RAISE EXCEPTION 'Fee cannot exceed amount'; END IF;
  IF p_description IS NOT NULL AND LENGTH(p_description) > 500 THEN RAISE EXCEPTION 'Description too long'; END IF;
  IF p_reference IS NOT NULL AND LENGTH(p_reference) > 100 THEN RAISE EXCEPTION 'Reference too long'; END IF;
  IF p_recipient_phone IS NOT NULL AND p_recipient_phone !~ '^[0-9A-Za-z\-]{3,20}$' THEN RAISE EXCEPTION 'Invalid recipient identifier'; END IF;

  SELECT COUNT(*) INTO v_rate_count
  FROM transfer_rate_limits
  WHERE user_id = v_user_id AND rpc_name = 'record_transaction'
    AND created_at > (now() - interval '1 hour');
  IF v_rate_count >= 20 THEN RAISE EXCEPTION 'Rate limit exceeded. Please try again later.'; END IF;
  INSERT INTO transfer_rate_limits (user_id, rpc_name) VALUES (v_user_id, 'record_transaction');

  v_total_deduction := p_amount + p_fee;

  SELECT balance INTO v_balance FROM profiles WHERE user_id = v_user_id FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF v_balance < v_total_deduction THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  v_new_balance := v_balance - v_total_deduction;
  UPDATE profiles SET balance = v_new_balance WHERE user_id = v_user_id;

  INSERT INTO transactions (user_id, type, amount, fee, balance_after, recipient_phone, recipient_name, description, reference, status)
  VALUES (v_user_id, p_type, p_amount, p_fee, v_new_balance, p_recipient_phone, p_recipient_name, p_description, p_reference, 'completed');

  IF p_fee > 0 THEN
    SELECT * INTO v_treasury FROM platform_treasury LIMIT 1 FOR UPDATE;
    IF v_treasury.id IS NOT NULL THEN
      v_new_treasury_balance := v_treasury.balance + p_fee;
      UPDATE platform_treasury SET balance = v_new_treasury_balance, total_earnings = total_earnings + p_fee, updated_at = now() WHERE id = v_treasury.id;
      INSERT INTO treasury_ledger (type, amount, balance_after, counterparty_user_id, description)
      VALUES ('earning', p_fee, v_new_treasury_balance, v_user_id, 'Fee from ' || p_type::text);
    END IF;
  END IF;

  RETURN json_build_object('success', true, 'new_balance', v_new_balance);
END;
$function$;

-- 3. Update transfer_money: add KYC check after auth
CREATE OR REPLACE FUNCTION public.transfer_money(p_type txn_type, p_recipient_type txn_type, p_amount numeric, p_fee numeric DEFAULT 0, p_commission numeric DEFAULT 0, p_recipient_phone text DEFAULT NULL::text, p_recipient_name text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_reference text DEFAULT NULL::text)
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
  IF v_recipient_profile.user_id IS NULL THEN RAISE EXCEPTION 'Recipient not found on EasyPay'; END IF;

  v_sender_new_balance := v_sender_balance - v_total_deduction;
  UPDATE profiles SET balance = v_sender_new_balance WHERE user_id = v_sender_id;

  v_sender_txn_id := gen_random_uuid();
  INSERT INTO transactions (id, user_id, type, amount, fee, commission, balance_after, recipient_phone, recipient_name, description, reference, status)
  VALUES (v_sender_txn_id, v_sender_id, p_type, p_amount, p_fee, 0, v_sender_new_balance, p_recipient_phone, COALESCE(p_recipient_name, v_recipient_profile.name), p_description, p_reference, 'completed');

  v_recipient_new_balance := v_recipient_profile.balance + p_amount + p_commission;
  v_recipient_txn_id := gen_random_uuid();
  UPDATE profiles SET balance = v_recipient_new_balance WHERE user_id = v_recipient_profile.user_id;
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
      INSERT INTO treasury_ledger (type, amount, balance_after, counterparty_user_id, description)
      VALUES ('earning', p_fee, v_new_treasury_balance, v_sender_id, 'Fee from ' || p_type::text);
    END IF;
  END IF;

  RETURN json_build_object(
    'success', true,
    'sender_balance', v_sender_new_balance,
    'sender_txn_id', v_sender_txn_id,
    'recipient_txn_id', v_recipient_txn_id,
    'recipient_name', v_recipient_profile.name
  );
END;
$function$;

-- 4. Update savings_deposit: add KYC check after auth
CREATE OR REPLACE FUNCTION public.savings_deposit(p_goal_id uuid, p_amount numeric, p_source text DEFAULT 'manual'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_balance NUMERIC;
  v_goal RECORD;
  v_new_balance NUMERIC;
  v_new_saved NUMERIC;
  v_goal_completed BOOLEAN := false;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  PERFORM require_kyc_verified(v_user_id);

  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  SELECT balance INTO v_balance FROM profiles WHERE user_id = v_user_id FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF v_balance < p_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  SELECT * INTO v_goal FROM savings_goals WHERE id = p_goal_id AND user_id = v_user_id FOR UPDATE;
  IF v_goal.id IS NULL THEN RAISE EXCEPTION 'Goal not found'; END IF;
  IF v_goal.status != 'active' THEN RAISE EXCEPTION 'Goal is not active'; END IF;

  v_new_balance := v_balance - p_amount;
  UPDATE profiles SET balance = v_new_balance WHERE user_id = v_user_id;

  v_new_saved := v_goal.saved_amount + p_amount;
  IF v_new_saved >= v_goal.target_amount THEN
    v_goal_completed := true;
    UPDATE savings_goals SET saved_amount = v_new_saved, status = 'completed', updated_at = now() WHERE id = p_goal_id;
  ELSE
    UPDATE savings_goals SET saved_amount = v_new_saved, updated_at = now() WHERE id = p_goal_id;
  END IF;

  INSERT INTO savings_deposits (goal_id, user_id, amount, source) VALUES (p_goal_id, v_user_id, p_amount, p_source);

  RETURN json_build_object(
    'success', true,
    'wallet_balance', v_new_balance,
    'goal_saved', v_new_saved,
    'goal_completed', v_goal_completed
  );
END;
$function$;
