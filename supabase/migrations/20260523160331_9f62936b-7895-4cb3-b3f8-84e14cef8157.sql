DROP FUNCTION IF EXISTS public.savings_deposit(uuid, numeric, text);

CREATE OR REPLACE FUNCTION public.savings_deposit(
  p_goal_id UUID,
  p_amount  NUMERIC,
  p_source  TEXT DEFAULT 'manual'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_balance   NUMERIC;
  v_goal      public.savings_goals;
  v_new_saved NUMERIC;
  v_completed BOOLEAN := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  SELECT balance INTO v_balance
    FROM public.profiles WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance. Available: ৳%', v_balance;
  END IF;

  SELECT * INTO v_goal
    FROM public.savings_goals WHERE id = p_goal_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Goal not found'; END IF;

  IF v_goal.status NOT IN ('active') THEN
    RAISE EXCEPTION 'Goal is not active (status: %)', v_goal.status;
  END IF;

  UPDATE public.profiles
    SET balance = balance - p_amount, updated_at = now()
    WHERE user_id = v_uid;

  v_new_saved := v_goal.saved_amount + p_amount;
  UPDATE public.savings_goals
    SET saved_amount = v_new_saved, updated_at = now()
    WHERE id = p_goal_id;

  INSERT INTO public.savings_deposits(user_id, goal_id, amount, source)
    VALUES(v_uid, p_goal_id, p_amount, p_source);

  IF v_goal.target_amount > 0 AND v_new_saved >= v_goal.target_amount THEN
    UPDATE public.savings_goals
      SET status = 'completed', updated_at = now()
      WHERE id = p_goal_id;
    v_completed := true;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'new_saved', v_new_saved,
    'goal_completed', v_completed
  );
END;
$$;