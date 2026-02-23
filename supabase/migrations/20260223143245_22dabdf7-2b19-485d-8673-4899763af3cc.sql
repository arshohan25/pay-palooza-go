
-- ============================================================
-- Add comprehensive input validation to transfer_money (all 3 overloads)
-- and record_transaction RPCs
-- ============================================================

-- 1) record_transaction: add validation
CREATE OR REPLACE FUNCTION public.record_transaction(
  p_type txn_type,
  p_amount numeric,
  p_fee numeric DEFAULT 0,
  p_recipient_phone text DEFAULT NULL,
  p_recipient_name text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_reference text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_balance NUMERIC;
  v_new_balance NUMERIC;
  v_total_deduction NUMERIC;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Input validation
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  IF p_amount > 1000000 THEN
    RAISE EXCEPTION 'Amount exceeds maximum limit';
  END IF;
  IF p_fee IS NULL OR p_fee < 0 THEN
    RAISE EXCEPTION 'Fee cannot be negative';
  END IF;
  IF p_fee > p_amount THEN
    RAISE EXCEPTION 'Fee cannot exceed amount';
  END IF;
  IF p_description IS NOT NULL AND LENGTH(p_description) > 500 THEN
    RAISE EXCEPTION 'Description too long';
  END IF;
  IF p_reference IS NOT NULL AND LENGTH(p_reference) > 100 THEN
    RAISE EXCEPTION 'Reference too long';
  END IF;
  IF p_recipient_phone IS NOT NULL AND p_recipient_phone !~ '^[0-9A-Za-z\-]{3,20}$' THEN
    RAISE EXCEPTION 'Invalid recipient identifier';
  END IF;

  SELECT balance INTO v_balance FROM profiles WHERE user_id = v_user_id FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF p_type = 'addmoney' THEN
    v_new_balance := v_balance + p_amount;
  ELSE
    v_total_deduction := p_amount + p_fee;
    IF v_balance < v_total_deduction THEN
      RAISE EXCEPTION 'Insufficient balance';
    END IF;
    v_new_balance := v_balance - v_total_deduction;
  END IF;

  UPDATE profiles SET balance = v_new_balance WHERE user_id = v_user_id;

  INSERT INTO transactions (user_id, type, amount, fee, balance_after, recipient_phone, recipient_name, description, reference, status)
  VALUES (v_user_id, p_type, p_amount, p_fee, v_new_balance, p_recipient_phone, p_recipient_name, p_description, p_reference, 'completed');

  RETURN json_build_object('success', true, 'balance', v_new_balance);
END;
$$;

-- 2) transfer_money (7 params): add validation
CREATE OR REPLACE FUNCTION public.transfer_money(
  p_recipient_phone text,
  p_amount numeric,
  p_fee numeric DEFAULT 0,
  p_type txn_type DEFAULT 'send',
  p_description text DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_recipient_name text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Input validation
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  IF p_amount > 1000000 THEN
    RAISE EXCEPTION 'Amount exceeds maximum limit';
  END IF;
  IF p_fee IS NULL OR p_fee < 0 THEN
    RAISE EXCEPTION 'Fee cannot be negative';
  END IF;
  IF p_fee > p_amount THEN
    RAISE EXCEPTION 'Fee cannot exceed amount';
  END IF;
  IF p_recipient_phone IS NULL OR LENGTH(p_recipient_phone) < 3 THEN
    RAISE EXCEPTION 'Invalid recipient';
  END IF;
  IF p_description IS NOT NULL AND LENGTH(p_description) > 500 THEN
    RAISE EXCEPTION 'Description too long';
  END IF;
  IF p_reference IS NOT NULL AND LENGTH(p_reference) > 100 THEN
    RAISE EXCEPTION 'Reference too long';
  END IF;

  v_total_deduction := p_amount + p_fee;

  SELECT balance INTO v_sender_balance FROM profiles WHERE user_id = v_sender_id FOR UPDATE;
  IF v_sender_balance IS NULL THEN RAISE EXCEPTION 'Sender profile not found'; END IF;
  IF v_sender_balance < v_total_deduction THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  SELECT user_id, balance, name INTO v_recipient_profile FROM profiles WHERE phone = p_recipient_phone FOR UPDATE;

  v_sender_new_balance := v_sender_balance - v_total_deduction;
  UPDATE profiles SET balance = v_sender_new_balance WHERE user_id = v_sender_id;

  v_sender_txn_id := gen_random_uuid();
  INSERT INTO transactions (id, user_id, type, amount, fee, balance_after, recipient_phone, recipient_name, description, reference, status)
  VALUES (v_sender_txn_id, v_sender_id, p_type, p_amount, p_fee, v_sender_new_balance, p_recipient_phone, COALESCE(p_recipient_name, v_recipient_profile.name), p_description, p_reference, 'completed');

  IF v_recipient_profile.user_id IS NOT NULL THEN
    v_recipient_new_balance := v_recipient_profile.balance + p_amount;
    v_recipient_txn_id := gen_random_uuid();
    UPDATE profiles SET balance = v_recipient_new_balance WHERE user_id = v_recipient_profile.user_id;
    INSERT INTO transactions (id, user_id, type, amount, fee, balance_after, recipient_phone, recipient_name, description, reference, status)
    VALUES (v_recipient_txn_id, v_recipient_profile.user_id, 'receive', p_amount, 0, v_recipient_new_balance,
      (SELECT phone FROM profiles WHERE user_id = v_sender_id),
      (SELECT name FROM profiles WHERE user_id = v_sender_id),
      p_description, p_reference, 'completed');
  END IF;

  RETURN json_build_object('success', true, 'sender_balance', v_sender_new_balance, 'recipient_found', v_recipient_profile.user_id IS NOT NULL, 'reference', p_reference);
END;
$$;

-- 3) transfer_money (8 params with recipient_type): add validation
CREATE OR REPLACE FUNCTION public.transfer_money(
  p_recipient_phone text,
  p_amount numeric,
  p_fee numeric DEFAULT 0,
  p_type txn_type DEFAULT 'send',
  p_description text DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_recipient_name text DEFAULT NULL,
  p_recipient_type txn_type DEFAULT 'receive'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  v_sender_new_balance := v_sender_balance - v_total_deduction;
  UPDATE profiles SET balance = v_sender_new_balance WHERE user_id = v_sender_id;

  v_sender_txn_id := gen_random_uuid();
  INSERT INTO transactions (id, user_id, type, amount, fee, balance_after, recipient_phone, recipient_name, description, reference, status)
  VALUES (v_sender_txn_id, v_sender_id, p_type, p_amount, p_fee, v_sender_new_balance, p_recipient_phone, COALESCE(p_recipient_name, v_recipient_profile.name), p_description, p_reference, 'completed');

  IF v_recipient_profile.user_id IS NOT NULL THEN
    v_recipient_new_balance := v_recipient_profile.balance + p_amount;
    v_recipient_txn_id := gen_random_uuid();
    UPDATE profiles SET balance = v_recipient_new_balance WHERE user_id = v_recipient_profile.user_id;
    INSERT INTO transactions (id, user_id, type, amount, fee, balance_after, recipient_phone, recipient_name, description, reference, status)
    VALUES (v_recipient_txn_id, v_recipient_profile.user_id, p_recipient_type, p_amount, 0, v_recipient_new_balance,
      (SELECT phone FROM profiles WHERE user_id = v_sender_id),
      (SELECT name FROM profiles WHERE user_id = v_sender_id),
      p_description, p_reference, 'completed');
  END IF;

  RETURN json_build_object('success', true, 'sender_balance', v_sender_new_balance, 'recipient_found', v_recipient_profile.user_id IS NOT NULL, 'reference', p_reference);
END;
$$;

-- 4) transfer_money (9 params with commission): add validation
CREATE OR REPLACE FUNCTION public.transfer_money(
  p_recipient_phone text,
  p_amount numeric,
  p_fee numeric DEFAULT 0,
  p_type txn_type DEFAULT 'send',
  p_description text DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_recipient_name text DEFAULT NULL,
  p_recipient_type txn_type DEFAULT 'receive',
  p_commission numeric DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  IF p_commission IS NULL OR p_commission < 0 THEN RAISE EXCEPTION 'Commission cannot be negative'; END IF;
  IF p_commission > p_amount THEN RAISE EXCEPTION 'Commission cannot exceed amount'; END IF;
  IF p_recipient_phone IS NULL OR LENGTH(p_recipient_phone) < 3 THEN RAISE EXCEPTION 'Invalid recipient'; END IF;
  IF p_description IS NOT NULL AND LENGTH(p_description) > 500 THEN RAISE EXCEPTION 'Description too long'; END IF;
  IF p_reference IS NOT NULL AND LENGTH(p_reference) > 100 THEN RAISE EXCEPTION 'Reference too long'; END IF;

  v_total_deduction := p_amount + p_fee;

  SELECT balance INTO v_sender_balance FROM profiles WHERE user_id = v_sender_id FOR UPDATE;
  IF v_sender_balance IS NULL THEN RAISE EXCEPTION 'Sender profile not found'; END IF;
  IF v_sender_balance < v_total_deduction THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  SELECT user_id, balance, name INTO v_recipient_profile FROM profiles WHERE phone = p_recipient_phone FOR UPDATE;

  v_sender_new_balance := v_sender_balance - v_total_deduction;
  UPDATE profiles SET balance = v_sender_new_balance WHERE user_id = v_sender_id;

  v_sender_txn_id := gen_random_uuid();
  INSERT INTO transactions (id, user_id, type, amount, fee, commission, balance_after, recipient_phone, recipient_name, description, reference, status)
  VALUES (v_sender_txn_id, v_sender_id, p_type, p_amount, p_fee, 0, v_sender_new_balance, p_recipient_phone, COALESCE(p_recipient_name, v_recipient_profile.name), p_description, p_reference, 'completed');

  IF v_recipient_profile.user_id IS NOT NULL THEN
    v_recipient_new_balance := v_recipient_profile.balance + p_amount + p_commission;
    v_recipient_txn_id := gen_random_uuid();
    UPDATE profiles SET balance = v_recipient_new_balance WHERE user_id = v_recipient_profile.user_id;
    INSERT INTO transactions (id, user_id, type, amount, fee, commission, balance_after, recipient_phone, recipient_name, description, reference, status)
    VALUES (v_recipient_txn_id, v_recipient_profile.user_id, p_recipient_type, p_amount, 0, p_commission, v_recipient_new_balance,
      (SELECT phone FROM profiles WHERE user_id = v_sender_id),
      (SELECT name FROM profiles WHERE user_id = v_sender_id),
      p_description, p_reference, 'completed');
  END IF;

  RETURN json_build_object('success', true, 'sender_balance', v_sender_new_balance, 'recipient_found', v_recipient_profile.user_id IS NOT NULL, 'reference', p_reference);
END;
$$;
