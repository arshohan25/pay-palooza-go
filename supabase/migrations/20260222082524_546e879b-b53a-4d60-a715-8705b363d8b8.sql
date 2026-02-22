-- Add chargeback to txn_type enum
ALTER TYPE public.txn_type ADD VALUE IF NOT EXISTS 'chargeback';

-- Admin chargeback RPC
CREATE OR REPLACE FUNCTION public.admin_chargeback(
  p_target_user_id UUID,
  p_amount NUMERIC,
  p_reason TEXT,
  p_reference_txn_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin_id UUID;
  v_target_balance NUMERIC;
  v_new_balance NUMERIC;
  v_actual_deduction NUMERIC;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL OR NOT has_role(v_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  SELECT balance INTO v_target_balance
  FROM profiles WHERE user_id = p_target_user_id FOR UPDATE;

  IF v_target_balance IS NULL THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  v_actual_deduction := LEAST(p_amount, v_target_balance);
  v_new_balance := v_target_balance - v_actual_deduction;

  UPDATE profiles SET balance = v_new_balance
  WHERE user_id = p_target_user_id;

  INSERT INTO transactions (user_id, type, amount, fee, balance_after,
    description, reference, status)
  VALUES (p_target_user_id, 'chargeback', v_actual_deduction, 0,
    v_new_balance, p_reason,
    COALESCE(p_reference_txn_id::text, NULL), 'completed');

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (v_admin_id, 'chargeback', 'profile', p_target_user_id,
    jsonb_build_object(
      'amount', v_actual_deduction,
      'reason', p_reason,
      'previous_balance', v_target_balance,
      'new_balance', v_new_balance,
      'reference_txn_id', p_reference_txn_id
    ));

  RETURN json_build_object(
    'success', true,
    'deducted', v_actual_deduction,
    'new_balance', v_new_balance
  );
END;
$$;