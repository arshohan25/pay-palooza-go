DROP FUNCTION IF EXISTS public.withdraw_completed_goal(uuid);

CREATE OR REPLACE FUNCTION public.withdraw_completed_goal(p_goal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_goal record;
  v_lock_until timestamptz;
  v_payout numeric;
  v_new_balance numeric;
  v_txn_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_goal FROM public.savings_goals
  WHERE id = p_goal_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Goal not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_goal.status <> 'active' THEN
    RAISE EXCEPTION 'Goal is not active' USING ERRCODE = 'P0001';
  END IF;

  v_lock_until := v_goal.created_at + INTERVAL '60 days';
  IF now() < v_lock_until THEN
    RAISE EXCEPTION 'Goal is locked until %', to_char(v_lock_until, 'DD Mon YYYY')
      USING ERRCODE = 'P0001';
  END IF;

  v_payout := COALESCE(v_goal.saved_amount, 0);
  IF v_payout <= 0 THEN
    RAISE EXCEPTION 'Nothing to withdraw' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.profiles
  SET balance = COALESCE(balance, 0) + v_payout, updated_at = now()
  WHERE id = v_user_id
  RETURNING balance INTO v_new_balance;

  UPDATE public.savings_goals
  SET status = 'withdrawn', saved_amount = 0,
      withdrawn_at = now(), withdrawn_amount = v_payout, updated_at = now()
  WHERE id = p_goal_id;

  INSERT INTO public.transactions (user_id, type, amount, status, description, metadata)
  VALUES (v_user_id, 'savings_withdraw', v_payout, 'completed',
          'Goal withdrawn: ' || COALESCE(v_goal.title, 'Savings Goal'),
          jsonb_build_object('goal_id', p_goal_id, 'goal_title', v_goal.title))
  RETURNING id INTO v_txn_id;

  RETURN jsonb_build_object('success', true, 'payout', v_payout, 'new_balance', v_new_balance, 'transaction_id', v_txn_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.withdraw_completed_goal(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_goal(p_goal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_goal record;
  v_lock_until timestamptz;
  v_refund numeric;
  v_new_balance numeric;
  v_txn_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_goal FROM public.savings_goals
  WHERE id = p_goal_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Goal not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_goal.status <> 'active' THEN
    RAISE EXCEPTION 'Goal is not active' USING ERRCODE = 'P0001';
  END IF;

  v_lock_until := v_goal.created_at + INTERVAL '60 days';
  IF now() < v_lock_until THEN
    RAISE EXCEPTION 'Goal is locked until %', to_char(v_lock_until, 'DD Mon YYYY')
      USING ERRCODE = 'P0001';
  END IF;

  v_refund := COALESCE(v_goal.saved_amount, 0);

  IF v_refund > 0 THEN
    UPDATE public.profiles
    SET balance = COALESCE(balance, 0) + v_refund, updated_at = now()
    WHERE id = v_user_id
    RETURNING balance INTO v_new_balance;

    INSERT INTO public.transactions (user_id, type, amount, status, description, metadata)
    VALUES (v_user_id, 'savings_refund', v_refund, 'completed',
            'Goal cancelled: ' || COALESCE(v_goal.title, 'Savings Goal'),
            jsonb_build_object('goal_id', p_goal_id, 'goal_title', v_goal.title))
    RETURNING id INTO v_txn_id;
  END IF;

  UPDATE public.savings_goals
  SET status = 'cancelled', saved_amount = 0,
      withdrawn_at = now(), withdrawn_amount = v_refund, updated_at = now()
  WHERE id = p_goal_id;

  RETURN jsonb_build_object('success', true, 'refund', v_refund, 'new_balance', COALESCE(v_new_balance, 0), 'transaction_id', v_txn_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_goal(uuid) TO authenticated;