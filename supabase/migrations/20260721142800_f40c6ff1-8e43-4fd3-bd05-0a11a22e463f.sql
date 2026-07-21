
-- 1. Biller settlements ledger (holds paybill amounts pending payout to real biller)
CREATE TABLE IF NOT EXISTS public.biller_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID,
  user_id UUID NOT NULL,
  biller_name TEXT NOT NULL,
  account_reference TEXT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded')),
  paid_at TIMESTAMPTZ,
  paid_by UUID,
  provider_ref TEXT,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.biller_settlements TO authenticated;
GRANT ALL ON public.biller_settlements TO service_role;

ALTER TABLE public.biller_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage biller settlements"
  ON public.biller_settlements FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users see their own biller settlements"
  ON public.biller_settlements FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_biller_settlements_status ON public.biller_settlements(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_biller_settlements_biller ON public.biller_settlements(biller_name, status);

-- 2. Update record_transaction: for paybill, hold amount in biller_settlements queue
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
AS $function$
DECLARE
  v_user_id UUID;
  v_balance NUMERIC;
  v_new_balance NUMERIC;
  v_total_deduction NUMERIC;
  v_rate_count INT;
  v_treasury RECORD;
  v_new_treasury_balance NUMERIC;
  v_txn_id UUID;
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
  VALUES (v_user_id, p_type, p_amount, p_fee, v_new_balance, p_recipient_phone, p_recipient_name, p_description, p_reference, 'completed')
  RETURNING id INTO v_txn_id;

  IF p_fee > 0 THEN
    SELECT * INTO v_treasury FROM platform_treasury LIMIT 1 FOR UPDATE;
    IF v_treasury.id IS NOT NULL THEN
      v_new_treasury_balance := v_treasury.balance + p_fee;
      UPDATE platform_treasury SET balance = v_new_treasury_balance, total_earnings = total_earnings + p_fee, updated_at = now() WHERE id = v_treasury.id;
      INSERT INTO treasury_ledger (type, amount, balance_after, counterparty_user_id, description)
      VALUES ('earning', p_fee, v_new_treasury_balance, v_user_id, 'Fee from ' || p_type::text);
    END IF;
  END IF;

  -- NEW: hold paybill amount in settlement queue so funds are traceable pending real biller payout
  IF p_type = 'paybill' THEN
    INSERT INTO biller_settlements (transaction_id, user_id, biller_name, account_reference, amount, reference, status)
    VALUES (
      v_txn_id,
      v_user_id,
      COALESCE(p_recipient_name, 'Unknown Biller'),
      p_recipient_phone,
      p_amount,
      p_reference,
      'pending'
    );
  END IF;

  RETURN json_build_object('success', true, 'new_balance', v_new_balance, 'transaction_id', v_txn_id);
END;
$function$;

-- 3. Admin RPC to mark a settlement as paid
CREATE OR REPLACE FUNCTION public.mark_biller_settlement_paid(
  p_settlement_id UUID,
  p_provider_ref TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin UUID;
BEGIN
  v_admin := auth.uid();
  IF v_admin IS NULL OR NOT has_role(v_admin, 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  UPDATE biller_settlements
    SET status = 'paid',
        paid_at = now(),
        paid_by = v_admin,
        provider_ref = COALESCE(p_provider_ref, provider_ref),
        admin_note = COALESCE(p_note, admin_note),
        updated_at = now()
    WHERE id = p_settlement_id AND status = 'pending';

  IF NOT FOUND THEN RAISE EXCEPTION 'Settlement not found or not pending'; END IF;
  RETURN json_build_object('success', true);
END;
$$;
