
-- Create table for OTP storage (simulated for dev, real SMS later)
CREATE TABLE public.otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code text NOT NULL,
  purpose text NOT NULL DEFAULT 'pin_reset',
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '5 minutes'),
  verified boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- No direct client access - only via edge functions with service role
CREATE POLICY "No direct access to otp_codes" ON public.otp_codes FOR ALL USING (false);

-- Index for lookups
CREATE INDEX idx_otp_codes_phone_purpose ON public.otp_codes (phone, purpose, created_at DESC);

-- Clean up expired OTPs automatically (optional, can also be done in edge function)
-- We'll handle cleanup in the edge function

-- Create table for transfer rate limiting
CREATE TABLE public.transfer_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  rpc_name text NOT NULL DEFAULT 'transfer_money',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.transfer_rate_limits ENABLE ROW LEVEL SECURITY;

-- No direct client access
CREATE POLICY "No direct access to transfer_rate_limits" ON public.transfer_rate_limits FOR ALL USING (false);

-- Index for rate limit checks
CREATE INDEX idx_transfer_rate_user ON public.transfer_rate_limits (user_id, rpc_name, created_at DESC);

-- Update transfer_money (9-param version with commission) to add rate limiting
CREATE OR REPLACE FUNCTION public.transfer_money(
  p_recipient_phone text, p_amount numeric, p_fee numeric DEFAULT 0,
  p_type txn_type DEFAULT 'send'::txn_type, p_description text DEFAULT NULL,
  p_reference text DEFAULT NULL, p_recipient_name text DEFAULT NULL,
  p_recipient_type txn_type DEFAULT 'receive'::txn_type, p_commission numeric DEFAULT 0
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
BEGIN
  v_sender_id := auth.uid();
  IF v_sender_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Input validation
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF p_amount > 1000000 THEN RAISE EXCEPTION 'Amount exceeds maximum limit'; END IF;
  IF p_fee IS NULL OR p_fee < 0 THEN RAISE EXCEPTION 'Fee cannot be negative'; END IF;
  IF p_fee > p_amount THEN RAISE EXCEPTION 'Fee cannot exceed amount'; END IF;
  IF p_commission IS NULL OR p_commission < 0 THEN RAISE EXCEPTION 'Commission cannot be negative'; END IF;
  IF p_commission > p_amount THEN RAISE EXCEPTION 'Commission cannot exceed amount'; END IF;
  IF p_recipient_phone IS NULL OR LENGTH(p_recipient_phone) < 3 THEN RAISE EXCEPTION 'Invalid recipient'; END IF;
  IF p_description IS NOT NULL AND LENGTH(p_description) > 500 THEN RAISE EXCEPTION 'Description too long'; END IF;
  IF p_reference IS NOT NULL AND LENGTH(p_reference) > 100 THEN RAISE EXCEPTION 'Reference too long'; END IF;

  -- Rate limiting: max 10 transfers per hour
  SELECT COUNT(*) INTO v_rate_count
  FROM transfer_rate_limits
  WHERE user_id = v_sender_id
    AND rpc_name = 'transfer_money'
    AND created_at > (now() - interval '1 hour');

  IF v_rate_count >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded. Maximum 10 transfers per hour.';
  END IF;

  -- Record this transfer for rate limiting
  INSERT INTO transfer_rate_limits (user_id, rpc_name) VALUES (v_sender_id, 'transfer_money');

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

-- Update record_transaction to add rate limiting too
CREATE OR REPLACE FUNCTION public.record_transaction(
  p_type txn_type, p_amount numeric, p_fee numeric DEFAULT 0,
  p_recipient_phone text DEFAULT NULL, p_recipient_name text DEFAULT NULL,
  p_description text DEFAULT NULL, p_reference text DEFAULT NULL
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user_id UUID;
  v_balance NUMERIC;
  v_new_balance NUMERIC;
  v_total_deduction NUMERIC;
  v_rate_count INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

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
$$;
