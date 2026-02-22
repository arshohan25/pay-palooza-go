
-- Admin reverse chargeback: credits back the deducted amount to user
CREATE OR REPLACE FUNCTION public.admin_reverse_chargeback(
  p_chargeback_txn_id UUID,
  p_reason TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin_id UUID;
  v_txn RECORD;
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL OR NOT has_role(v_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  -- Get the original chargeback transaction
  SELECT id, user_id, amount, status, type, reference
  INTO v_txn
  FROM transactions
  WHERE id = p_chargeback_txn_id
  FOR UPDATE;

  IF v_txn.id IS NULL THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  IF v_txn.type != 'chargeback' THEN
    RAISE EXCEPTION 'Transaction is not a chargeback';
  END IF;

  IF v_txn.status = 'reversed' THEN
    RAISE EXCEPTION 'Chargeback already reversed';
  END IF;

  -- Lock and get current user balance
  SELECT balance INTO v_current_balance
  FROM profiles
  WHERE user_id = v_txn.user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- Credit back the amount
  v_new_balance := v_current_balance + v_txn.amount;

  UPDATE profiles SET balance = v_new_balance
  WHERE user_id = v_txn.user_id;

  -- Mark original chargeback as reversed
  UPDATE transactions SET status = 'reversed'
  WHERE id = p_chargeback_txn_id;

  -- Insert a credit-back transaction (addmoney type)
  INSERT INTO transactions (user_id, type, amount, fee, balance_after,
    description, reference, status)
  VALUES (v_txn.user_id, 'addmoney', v_txn.amount, 0,
    v_new_balance,
    'Chargeback reversal: ' || p_reason,
    p_chargeback_txn_id::text,
    'completed');

  -- Audit log
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (v_admin_id, 'chargeback_reversal', 'transaction', p_chargeback_txn_id,
    jsonb_build_object(
      'amount', v_txn.amount,
      'reason', p_reason,
      'target_user_id', v_txn.user_id,
      'previous_balance', v_current_balance,
      'new_balance', v_new_balance
    ));

  RETURN json_build_object(
    'success', true,
    'credited', v_txn.amount,
    'new_balance', v_new_balance
  );
END;
$$;
