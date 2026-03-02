
-- 1. Create treasury ledger type enum
CREATE TYPE public.treasury_ledger_type AS ENUM (
  'disburse', 'earning', 'commission_paid', 'user_addmoney', 'initial_deposit'
);

-- 2. Create platform_treasury table (single-row config)
CREATE TABLE public.platform_treasury (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  balance NUMERIC NOT NULL DEFAULT 0,
  total_earnings NUMERIC NOT NULL DEFAULT 0,
  total_commissions_paid NUMERIC NOT NULL DEFAULT 0,
  total_disbursed NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_treasury ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view treasury"
  ON public.platform_treasury FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update treasury"
  ON public.platform_treasury FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Create treasury_ledger table
CREATE TABLE public.treasury_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type treasury_ledger_type NOT NULL,
  amount NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL,
  counterparty_user_id UUID,
  counterparty_role TEXT,
  description TEXT,
  reference TEXT,
  actor_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.treasury_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view treasury ledger"
  ON public.treasury_ledger FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- No direct insert from clients; only via SECURITY DEFINER RPCs

-- 4. Seed initial treasury balance
INSERT INTO public.platform_treasury (balance, total_earnings, total_commissions_paid, total_disbursed)
VALUES (10000000000, 0, 0, 0);

INSERT INTO public.treasury_ledger (type, amount, balance_after, description)
VALUES ('initial_deposit', 10000000000, 10000000000, 'Initial platform treasury deposit: ৳1000 Crores');

-- 5. RPC: admin_disburse_funds
CREATE OR REPLACE FUNCTION public.admin_disburse_funds(
  p_target_phone TEXT,
  p_amount NUMERIC,
  p_description TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin_id UUID;
  v_treasury RECORD;
  v_target RECORD;
  v_new_treasury_balance NUMERIC;
  v_target_new_balance NUMERIC;
  v_target_roles TEXT[];
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL OR NOT has_role(v_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  IF p_amount > 1000000000 THEN
    RAISE EXCEPTION 'Amount exceeds single disbursement limit';
  END IF;
  IF p_target_phone IS NULL OR LENGTH(p_target_phone) < 3 THEN
    RAISE EXCEPTION 'Invalid target phone';
  END IF;

  -- Lock treasury row
  SELECT * INTO v_treasury FROM platform_treasury LIMIT 1 FOR UPDATE;
  IF v_treasury.id IS NULL THEN
    RAISE EXCEPTION 'Treasury not initialized';
  END IF;
  IF v_treasury.balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient treasury balance';
  END IF;

  -- Lock target profile
  SELECT user_id, balance, name INTO v_target FROM profiles WHERE phone = p_target_phone FOR UPDATE;
  IF v_target.user_id IS NULL THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  -- Get target roles
  SELECT array_agg(role::text) INTO v_target_roles FROM user_roles WHERE user_id = v_target.user_id;

  -- Debit treasury
  v_new_treasury_balance := v_treasury.balance - p_amount;
  UPDATE platform_treasury SET balance = v_new_treasury_balance, total_disbursed = total_disbursed + p_amount, updated_at = now() WHERE id = v_treasury.id;

  -- Credit target
  v_target_new_balance := v_target.balance + p_amount;
  UPDATE profiles SET balance = v_target_new_balance WHERE user_id = v_target.user_id;

  -- Record in treasury_ledger
  INSERT INTO treasury_ledger (type, amount, balance_after, counterparty_user_id, counterparty_role, description, reference, actor_id)
  VALUES ('disburse', p_amount, v_new_treasury_balance, v_target.user_id, COALESCE(v_target_roles[1], 'customer'), p_description, 'DISB-' || to_char(now(), 'YYYYMMDD-HH24MISS'), v_admin_id);

  -- Record in transactions for target user
  INSERT INTO transactions (user_id, type, amount, fee, balance_after, description, reference, status)
  VALUES (v_target.user_id, 'addmoney', p_amount, 0, v_target_new_balance, COALESCE(p_description, 'Treasury disbursement'), 'DISB-' || to_char(now(), 'YYYYMMDD-HH24MISS'), 'completed');

  -- Audit log
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (v_admin_id, 'treasury_disburse', 'profile', v_target.user_id,
    jsonb_build_object('amount', p_amount, 'target_phone', p_target_phone, 'target_name', v_target.name, 'new_treasury_balance', v_new_treasury_balance));

  RETURN json_build_object('success', true, 'new_treasury_balance', v_new_treasury_balance, 'target_new_balance', v_target_new_balance, 'target_name', v_target.name);
END;
$$;

-- 6. RPC: treasury_debit_for_addmoney (called by payment webhook via service role)
CREATE OR REPLACE FUNCTION public.treasury_debit_for_addmoney(
  p_user_id UUID,
  p_amount NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_treasury RECORD;
  v_new_balance NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  SELECT * INTO v_treasury FROM platform_treasury LIMIT 1 FOR UPDATE;
  IF v_treasury.id IS NULL THEN
    RAISE EXCEPTION 'Treasury not initialized';
  END IF;

  -- Allow treasury to go negative for add-money (operational obligation)
  v_new_balance := v_treasury.balance - p_amount;
  UPDATE platform_treasury SET balance = v_new_balance, updated_at = now() WHERE id = v_treasury.id;

  INSERT INTO treasury_ledger (type, amount, balance_after, counterparty_user_id, description)
  VALUES ('user_addmoney', p_amount, v_new_balance, p_user_id, 'User add money via gateway');

  RETURN json_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

-- 7. Modify record_transaction to credit fees to treasury
CREATE OR REPLACE FUNCTION public.record_transaction(
  p_type txn_type,
  p_amount NUMERIC,
  p_fee NUMERIC DEFAULT 0,
  p_recipient_phone TEXT DEFAULT NULL,
  p_recipient_name TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_reference TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  WHERE user_id = v_user_id AND rpc_name = 'record_transaction' AND created_at > (now() - interval '1 hour');
  IF v_rate_count >= 10 THEN RAISE EXCEPTION 'Rate limit exceeded. Maximum 10 transactions per hour.'; END IF;
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

  -- Credit fee to treasury earnings
  IF p_fee > 0 THEN
    SELECT * INTO v_treasury FROM platform_treasury LIMIT 1 FOR UPDATE;
    IF v_treasury.id IS NOT NULL THEN
      v_new_treasury_balance := v_treasury.balance + p_fee;
      UPDATE platform_treasury SET balance = v_new_treasury_balance, total_earnings = total_earnings + p_fee, updated_at = now() WHERE id = v_treasury.id;
      INSERT INTO treasury_ledger (type, amount, balance_after, counterparty_user_id, description, reference)
      VALUES ('earning', p_fee, v_new_treasury_balance, v_user_id, 'Fee from ' || p_type::text || ' transaction', p_reference);
    END IF;
  END IF;

  RETURN json_build_object('success', true, 'balance', v_new_balance);
END;
$$;

-- 8. Modify transfer_money (latest 3-arg version) to credit fees to treasury
CREATE OR REPLACE FUNCTION public.transfer_money(
  p_recipient_phone TEXT,
  p_amount NUMERIC,
  p_fee NUMERIC DEFAULT 0,
  p_type txn_type DEFAULT 'send',
  p_description TEXT DEFAULT NULL,
  p_reference TEXT DEFAULT NULL,
  p_recipient_name TEXT DEFAULT NULL,
  p_recipient_type txn_type DEFAULT 'receive',
  p_commission NUMERIC DEFAULT 0
)
RETURNS JSON
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
  IF p_commission > 0 AND v_recipient_profile.user_id IS NOT NULL THEN
    SELECT * INTO v_treasury FROM platform_treasury LIMIT 1 FOR UPDATE;
    IF v_treasury.id IS NOT NULL THEN
      v_new_treasury_balance := v_treasury.balance - p_commission;
      UPDATE platform_treasury SET balance = v_new_treasury_balance, total_commissions_paid = total_commissions_paid + p_commission, updated_at = now() WHERE id = v_treasury.id;
      INSERT INTO treasury_ledger (type, amount, balance_after, counterparty_user_id, counterparty_role, description, reference)
      VALUES ('commission_paid', p_commission, v_new_treasury_balance, v_recipient_profile.user_id, 'agent', 'Commission for ' || p_type::text, p_reference);
    END IF;
  END IF;

  RETURN json_build_object('success', true, 'sender_balance', v_sender_new_balance, 'recipient_found', v_recipient_profile.user_id IS NOT NULL, 'reference', p_reference);
END;
$$;
