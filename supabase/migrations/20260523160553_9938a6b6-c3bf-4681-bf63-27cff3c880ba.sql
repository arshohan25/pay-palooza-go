CREATE OR REPLACE FUNCTION cancel_goal(p_goal_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_goal      savings_goals;
  v_lock_end  TIMESTAMPTZ;
  v_days_left INT;
BEGIN
  SELECT * INTO v_goal
    FROM savings_goals WHERE id = p_goal_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Goal not found'; END IF;
  IF v_goal.status NOT IN ('active','completed') THEN
    RAISE EXCEPTION 'Goal cannot be cancelled (status: %)', v_goal.status;
  END IF;
  -- Enforce 60-day lock
  v_lock_end  := v_goal.created_at + INTERVAL '60 days';
  v_days_left := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_lock_end - now())) / 86400))::INT;
  IF now() < v_lock_end THEN
    RAISE EXCEPTION 'Goal is locked for % more days', v_days_left;
  END IF;
  -- Refund saved_amount to wallet
  IF v_goal.saved_amount > 0 THEN
    UPDATE profiles
      SET balance    = balance + v_goal.saved_amount,
          updated_at = now()
      WHERE user_id = v_uid;
  END IF;
  UPDATE savings_goals
    SET status           = 'cancelled',
        withdrawn_amount = v_goal.saved_amount,
        withdrawn_at     = now(),
        updated_at       = now()
    WHERE id = p_goal_id;
  RETURN jsonb_build_object(
    'success', true,
    'refund',  v_goal.saved_amount
  );
END;
$$;