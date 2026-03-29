
CREATE OR REPLACE FUNCTION public.record_transaction(
  p_type text,
  p_amount numeric,
  p_recipient text DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_fee numeric DEFAULT 0,
  p_cashback numeric DEFAULT 0,
  p_metadata jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_balance numeric;
  v_total_debit numeric;
  v_new_balance numeric;
  v_txn_id uuid;
  v_recipient_id uuid;
  v_recipient_balance numeric;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- KYC check: skip for recharge and addmoney
  IF p_type NOT IN ('recharge', 'addmoney') THEN
    PERFORM require_kyc_verified(v_user_id);
  END IF;

  SELECT balance INTO v_balance FROM profiles WHERE user_id = v_user_id FOR UPDATE;
  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  v_total_debit := p_amount + COALESCE(p_fee, 0);

  IF p_type NOT IN ('addmoney', 'cashback') THEN
    IF v_balance < v_total_debit THEN
      RAISE EXCEPTION 'Insufficient balance';
    END IF;
    v_new_balance := v_balance - v_total_debit + COALESCE(p_cashback, 0);
  ELSE
    v_new_balance := v_balance + p_amount;
  END IF;

  UPDATE profiles SET balance = v_new_balance WHERE user_id = v_user_id;

  INSERT INTO transactions (user_id, type, amount, recipient, note, fee, cashback, status, metadata)
  VALUES (v_user_id, p_type, p_amount, p_recipient, p_note, p_fee, p_cashback, 'completed', p_metadata)
  RETURNING id INTO v_txn_id;

  -- Credit recipient if applicable
  IF p_recipient IS NOT NULL AND p_type IN ('send', 'payment') THEN
    SELECT user_id INTO v_recipient_id FROM profiles WHERE phone = p_recipient;
    IF v_recipient_id IS NOT NULL THEN
      UPDATE profiles SET balance = balance + p_amount WHERE user_id = v_recipient_id;
    END IF;
  END IF;

  RETURN v_txn_id;
END;
$$;
