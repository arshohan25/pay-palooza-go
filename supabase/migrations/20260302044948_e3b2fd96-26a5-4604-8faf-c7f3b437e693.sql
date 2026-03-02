
CREATE OR REPLACE FUNCTION public.credit_cashback(
  p_user_id UUID,
  p_amount NUMERIC,
  p_description TEXT DEFAULT NULL,
  p_reference TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_balance NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  -- Validate inputs
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Cashback amount must be positive';
  END IF;
  IF p_amount > 1000 THEN
    RAISE EXCEPTION 'Cashback amount exceeds maximum';
  END IF;

  -- Atomically lock and update balance
  SELECT balance INTO v_balance FROM profiles WHERE user_id = p_user_id FOR UPDATE;
  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  v_new_balance := v_balance + p_amount;

  UPDATE profiles SET balance = v_new_balance WHERE user_id = p_user_id;

  -- Record cashback transaction
  INSERT INTO transactions (user_id, type, amount, fee, balance_after, description, reference, status)
  VALUES (p_user_id, 'addmoney', p_amount, 0, v_new_balance, p_description, p_reference, 'completed');

  RETURN json_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;
