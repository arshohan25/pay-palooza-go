CREATE OR REPLACE FUNCTION withdraw_completed_goal(p_goal_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_goal   savings_goals;
  v_amount NUMERIC;
BEGIN
  SELECT * INTO v_goal
    FROM savings_goals WHERE id = p_goal_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Goal not found'; END IF;
  IF v_goal.status NOT IN ('active','completed') THEN
    RAISE EXCEPTION 'Goal is not withdrawable (status: %)', v_goal.status;
  END IF;
  IF v_goal.saved_amount <= 0 THEN
    RAISE EXCEPTION 'Nothing to withdraw';
  END IF;
  v_amount := v_goal.saved_amount;
  UPDATE profiles
    SET balance    = balance + v_amount,
        updated_at = now()
    WHERE user_id = v_uid;
  UPDATE savings_goals
    SET status           = 'withdrawn',
        withdrawn_amount = v_amount,
        withdrawn_at     = now(),
        saved_amount     = 0,
        updated_at       = now()
    WHERE id = p_goal_id;
  RETURN jsonb_build_object('success', true, 'amount', v_amount);
END;
$$;