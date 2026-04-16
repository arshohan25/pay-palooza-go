
CREATE OR REPLACE FUNCTION public.savings_deposit(p_goal_id uuid, p_amount numeric, p_source text DEFAULT 'manual'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_balance NUMERIC;
  v_goal RECORD;
  v_new_balance NUMERIC;
  v_new_saved NUMERIC;
  v_goal_completed BOOLEAN := false;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  PERFORM require_kyc_verified(v_user_id);

  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  SELECT balance INTO v_balance FROM profiles WHERE user_id = v_user_id FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF v_balance < p_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  SELECT * INTO v_goal FROM savings_goals WHERE id = p_goal_id AND user_id = v_user_id;
  IF v_goal.id IS NULL THEN RAISE EXCEPTION 'Goal not found'; END IF;
  IF v_goal.status != 'active' THEN RAISE EXCEPTION 'Goal is not active'; END IF;

  v_new_balance := v_balance - p_amount;
  v_new_saved := v_goal.saved_amount + p_amount;

  IF v_new_saved >= v_goal.target_amount THEN
    v_goal_completed := true;
  END IF;

  UPDATE profiles SET balance = v_new_balance WHERE user_id = v_user_id;

  UPDATE savings_goals SET
    saved_amount = v_new_saved,
    status = CASE WHEN v_goal_completed THEN 'completed' ELSE 'active' END,
    updated_at = now()
  WHERE id = p_goal_id;

  INSERT INTO savings_deposits (goal_id, user_id, amount, source)
  VALUES (p_goal_id, v_user_id, p_amount, p_source);

  -- Record in transactions table so it appears in history
  INSERT INTO transactions (user_id, type, amount, fee, balance_after, description, reference, status, short_id)
  VALUES (
    v_user_id,
    'payment',
    p_amount,
    0,
    v_new_balance,
    'Savings Goal: ' || v_goal.name,
    'GOAL-DEP-' || upper(substring(gen_random_uuid()::text, 1, 8)),
    'completed',
    upper(substring(gen_random_uuid()::text, 1, 12))
  );

  RETURN json_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'saved_amount', v_new_saved,
    'goal_completed', v_goal_completed
  );
END;
$function$;
