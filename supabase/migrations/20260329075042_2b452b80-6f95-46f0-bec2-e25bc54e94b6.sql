CREATE OR REPLACE FUNCTION public.transfer_money(
  p_recipient_phone TEXT,
  p_amount NUMERIC,
  p_fee NUMERIC DEFAULT 0,
  p_commission NUMERIC DEFAULT 0,
  p_type TEXT DEFAULT 'send',
  p_recipient_type TEXT DEFAULT 'receive',
  p_description TEXT DEFAULT NULL,
  p_reference TEXT DEFAULT NULL,
  p_recipient_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  v_rate_count INT;
  v_treasury RECORD;
  v_new_treasury_balance NUMERIC;
  v_dup_count INT;
BEGIN
  v_sender_id := auth.uid();
  IF v_sender_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- KYC enforcement: block non-verified users from transfers
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
      RAISE EXCEPTION 'Duplicate transaction: you already sent this amount to this number within the last 5 minutes.';
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

  IF p_fee > 0 THEN
    SELECT * INTO v_treasury FROM platform_treasury LIMIT 1 FOR UPDATE;
    IF v_treasury.id IS NOT NULL THEN
      v_new_treasury_balance := v_treasury.balance + p_fee;
      UPDATE platform_treasury SET balance = v_new_treasury_balance, total_earnings = total_earnings + p_fee, updated_at = now() WHERE id = v_treasury.id;
      INSERT INTO treasury_ledger (treasury_id, type, amount, balance_after, description, reference_id)
      VALUES (v_treasury.id, 'fee_income', p_fee, v_new_treasury_balance, p_type || ' fee from transfer', v_sender_txn_id::text);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'sender_txn_id', v_sender_txn_id,
    'recipient_txn_id', v_recipient_txn_id,
    'sender_new_balance', v_sender_new_balance
  );
END;
$$;