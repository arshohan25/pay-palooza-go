
-- Update all three transfer_money overloads to reject when recipient not found

-- Overload 1: 7 params (basic)
CREATE OR REPLACE FUNCTION public.transfer_money(p_recipient_phone text, p_amount numeric, p_fee numeric DEFAULT 0, p_type txn_type DEFAULT 'send'::txn_type, p_description text DEFAULT NULL::text, p_reference text DEFAULT NULL::text, p_recipient_name text DEFAULT NULL::text)
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
BEGIN
  v_sender_id := auth.uid();
  IF v_sender_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF p_amount > 1000000 THEN RAISE EXCEPTION 'Amount exceeds maximum limit'; END IF;
  IF p_fee IS NULL OR p_fee < 0 THEN RAISE EXCEPTION 'Fee cannot be negative'; END IF;
  IF p_fee > p_amount THEN RAISE EXCEPTION 'Fee cannot exceed amount'; END IF;
  IF p_recipient_phone IS NULL OR LENGTH(p_recipient_phone) < 3 THEN RAISE EXCEPTION 'Invalid recipient'; END IF;
  IF p_description IS NOT NULL AND LENGTH(p_description) > 500 THEN RAISE EXCEPTION 'Description too long'; END IF;
  IF p_reference IS NOT NULL AND LENGTH(p_reference) > 100 THEN RAISE EXCEPTION 'Reference too long'; END IF;

  v_total_deduction := p_amount + p_fee;

  SELECT balance INTO v_sender_balance FROM profiles WHERE user_id = v_sender_id FOR UPDATE;
  IF v_sender_balance IS NULL THEN RAISE EXCEPTION 'Sender profile not found'; END IF;
  IF v_sender_balance < v_total_deduction THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  SELECT user_id, balance, name INTO v_recipient_profile FROM profiles WHERE phone = p_recipient_phone FOR UPDATE;

  IF v_recipient_profile.user_id IS NULL THEN
    RAISE EXCEPTION 'Recipient not found on EasyPay';
  END IF;

  v_sender_new_balance := v_sender_balance - v_total_deduction;
  UPDATE profiles SET balance = v_sender_new_balance WHERE user_id = v_sender_id;

  v_sender_txn_id := gen_random_uuid();
  INSERT INTO transactions (id, user_id, type, amount, fee, balance_after, recipient_phone, recipient_name, description, reference, status)
  VALUES (v_sender_txn_id, v_sender_id, p_type, p_amount, p_fee, v_sender_new_balance, p_recipient_phone, COALESCE(p_recipient_name, v_recipient_profile.name), p_description, p_reference, 'completed');

  v_recipient_new_balance := v_recipient_profile.balance + p_amount;
  v_recipient_txn_id := gen_random_uuid();
  UPDATE profiles SET balance = v_recipient_new_balance WHERE user_id = v_recipient_profile.user_id;
  INSERT INTO transactions (id, user_id, type, amount, fee, balance_after, recipient_phone, recipient_name, description, reference, status)
  VALUES (v_recipient_txn_id, v_recipient_profile.user_id, 'receive', p_amount, 0, v_recipient_new_balance,
    (SELECT phone FROM profiles WHERE user_id = v_sender_id),
    (SELECT name FROM profiles WHERE user_id = v_sender_id),
    p_description, p_reference, 'completed');

  RETURN json_build_object('success', true, 'sender_balance', v_sender_new_balance, 'recipient_found', true, 'reference', p_reference);
END;
$function$;

-- Overload 2: 8 params (with p_recipient_type)
CREATE OR REPLACE FUNCTION public.transfer_money(p_recipient_phone text, p_amount numeric, p_fee numeric DEFAULT 0, p_type txn_type DEFAULT 'send'::txn_type, p_description text DEFAULT NULL::text, p_reference text DEFAULT NULL::text, p_recipient_name text DEFAULT NULL::text, p_recipient_type txn_type DEFAULT 'receive'::txn_type)
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
BEGIN
  v_sender_id := auth.uid();
  IF v_sender_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF p_amount > 1000000 THEN RAISE EXCEPTION 'Amount exceeds maximum limit'; END IF;
  IF p_fee IS NULL OR p_fee < 0 THEN RAISE EXCEPTION 'Fee cannot be negative'; END IF;
  IF p_fee > p_amount THEN RAISE EXCEPTION 'Fee cannot exceed amount'; END IF;
  IF p_recipient_phone IS NULL OR LENGTH(p_recipient_phone) < 3 THEN RAISE EXCEPTION 'Invalid recipient'; END IF;
  IF p_description IS NOT NULL AND LENGTH(p_description) > 500 THEN RAISE EXCEPTION 'Description too long'; END IF;
  IF p_reference IS NOT NULL AND LENGTH(p_reference) > 100 THEN RAISE EXCEPTION 'Reference too long'; END IF;

  v_total_deduction := p_amount + p_fee;

  SELECT balance INTO v_sender_balance FROM profiles WHERE user_id = v_sender_id FOR UPDATE;
  IF v_sender_balance IS NULL THEN RAISE EXCEPTION 'Sender profile not found'; END IF;
  IF v_sender_balance < v_total_deduction THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  SELECT user_id, balance, name INTO v_recipient_profile FROM profiles WHERE phone = p_recipient_phone FOR UPDATE;

  IF v_recipient_profile.user_id IS NULL THEN
    RAISE EXCEPTION 'Recipient not found on EasyPay';
  END IF;

  v_sender_new_balance := v_sender_balance - v_total_deduction;
  UPDATE profiles SET balance = v_sender_new_balance WHERE user_id = v_sender_id;

  v_sender_txn_id := gen_random_uuid();
  INSERT INTO transactions (id, user_id, type, amount, fee, balance_after, recipient_phone, recipient_name, description, reference, status)
  VALUES (v_sender_txn_id, v_sender_id, p_type, p_amount, p_fee, v_sender_new_balance, p_recipient_phone, COALESCE(p_recipient_name, v_recipient_profile.name), p_description, p_reference, 'completed');

  v_recipient_new_balance := v_recipient_profile.balance + p_amount;
  v_recipient_txn_id := gen_random_uuid();
  UPDATE profiles SET balance = v_recipient_new_balance WHERE user_id = v_recipient_profile.user_id;
  INSERT INTO transactions (id, user_id, type, amount, fee, balance_after, recipient_phone, recipient_name, description, reference, status)
  VALUES (v_recipient_txn_id, v_recipient_profile.user_id, p_recipient_type, p_amount, 0, v_recipient_new_balance,
    (SELECT phone FROM profiles WHERE user_id = v_sender_id),
    (SELECT name FROM profiles WHERE user_id = v_sender_id),
    p_description, p_reference, 'completed');

  RETURN json_build_object('success', true, 'sender_balance', v_sender_new_balance, 'recipient_found', true, 'reference', p_reference);
END;
$function$;

-- Overload 3: 9 params (with p_commission)
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
BEGIN
  v_sender_id := auth.uid();
  IF v_sender_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF p_amount > 1000000 THEN RAISE EXCEPTION 'Amount exceeds maximum limit'; END IF;
  IF p_fee IS NULL OR p_fee < 0 THEN RAISE EXCEPTION 'Fee cannot be negative'; END IF;
  IF p_fee > p_amount THEN RAISE EXCEPTION 'Fee cannot exceed amount'; END IF;
  IF p_commission IS NULL OR p_commission < 0 THEN RAISE EXCEPTION 'Commission cannot be negative'; END IF;
  IF p_commission > p_amount THEN RAISE EXCEPTION 'Commission cannot exceed amount'; END IF;
  IF p_recipient_phone IS NULL OR LENGTH(p_recipient_phone) < 3 THEN RAISE EXCEPTION 'Invalid recipient'; END IF;
  IF p_description IS NOT NULL AND LENGTH(p_description) > 500 THEN RAISE EXCEPTION 'Description too long'; END IF;
  IF p_reference IS NOT NULL AND LENGTH(p_reference) > 100 THEN RAISE EXCEPTION 'Reference too long'; END IF;

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

  IF v_recipient_profile.user_id IS NULL THEN
    RAISE EXCEPTION 'Recipient not found on EasyPay';
  END IF;

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

  -- Credit fee to treasury earnings
  IF p_fee > 0 THEN
    SELECT * INTO v_treasury FROM platform_treasury LIMIT 1 FOR UPDATE;
    IF v_treasury.id IS NOT NULL THEN
      v_new_treasury_balance := v_treasury.balance + p_fee;
      UPDATE platform_treasury SET balance = v_new_treasury_balance, total_earnings = total_earnings + p_fee, updated_at = now() WHERE id = v_treasury.id;
      INSERT INTO treasury_ledger (type, amount, balance_after, counterparty_user_id, description, reference)
      VALUES ('earning', p_fee, v_new_treasury_balance, v_sender_id, 'Fee from ' || p_type::text || ' transfer', p_reference);
    END IF;
  END IF;

  -- Record commission paid from treasury
  IF p_commission > 0 THEN
    SELECT * INTO v_treasury FROM platform_treasury LIMIT 1 FOR UPDATE;
    IF v_treasury.id IS NOT NULL THEN
      v_new_treasury_balance := v_treasury.balance - p_commission;
      UPDATE platform_treasury SET balance = v_new_treasury_balance, total_commissions_paid = total_commissions_paid + p_commission, updated_at = now() WHERE id = v_treasury.id;
      INSERT INTO treasury_ledger (type, amount, balance_after, counterparty_user_id, counterparty_role, description, reference)
      VALUES ('commission_paid', p_commission, v_new_treasury_balance, v_recipient_profile.user_id, 'agent', 'Commission for ' || p_type::text, p_reference);
    END IF;
  END IF;

  RETURN json_build_object('success', true, 'sender_balance', v_sender_new_balance, 'recipient_found', true, 'reference', p_reference);
END;
$function$;
