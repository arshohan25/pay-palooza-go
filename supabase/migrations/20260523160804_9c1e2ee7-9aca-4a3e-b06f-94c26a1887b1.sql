DROP FUNCTION IF EXISTS settle_matured_dps(UUID);

CREATE OR REPLACE FUNCTION settle_matured_dps(p_plan_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_plan      savings_auto_save;
  v_goal      savings_goals;
  v_principal NUMERIC;
  v_return    NUMERIC;
  v_profit    NUMERIC;
  v_total     NUMERIC;
BEGIN
  SELECT * INTO v_plan
    FROM savings_auto_save WHERE id = p_plan_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND OR v_plan.settled THEN
    RAISE EXCEPTION 'Plan not eligible for settlement';
  END IF;
  IF v_plan.goal_id IS NULL THEN RAISE EXCEPTION 'No linked goal'; END IF;
  SELECT * INTO v_goal
    FROM savings_goals WHERE id = v_plan.goal_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND OR v_goal.saved_amount <= 0 THEN
    RAISE EXCEPTION 'No principal to settle';
  END IF;
  v_principal := v_goal.saved_amount;
  v_return := CASE
    WHEN v_plan.strategy = 'gold'   AND v_plan.duration = '6m'  THEN 2.0
    WHEN v_plan.strategy = 'gold'   AND v_plan.duration = '1y'  THEN 2.5
    WHEN v_plan.strategy = 'gold'   AND v_plan.duration = '2y'  THEN 3.0
    WHEN v_plan.strategy = 'gold'   AND v_plan.duration = '3y'  THEN 3.5
    WHEN v_plan.strategy = 'gold'   AND v_plan.duration = '5y'  THEN 4.0
    WHEN v_plan.strategy = 'gold'   AND v_plan.duration = '10y' THEN 4.5
    WHEN v_plan.strategy = 'mixed'  AND v_plan.duration = '6m'  THEN 2.5
    WHEN v_plan.strategy = 'mixed'  AND v_plan.duration = '1y'  THEN 3.0
    WHEN v_plan.strategy = 'mixed'  AND v_plan.duration = '2y'  THEN 3.5
    WHEN v_plan.strategy = 'mixed'  AND v_plan.duration = '3y'  THEN 4.0
    WHEN v_plan.strategy = 'mixed'  AND v_plan.duration = '5y'  THEN 4.5
    WHEN v_plan.strategy = 'mixed'  AND v_plan.duration = '10y' THEN 5.0
    WHEN v_plan.strategy = 'stocks' AND v_plan.duration = '6m'  THEN 3.0
    WHEN v_plan.strategy = 'stocks' AND v_plan.duration = '1y'  THEN 3.5
    WHEN v_plan.strategy = 'stocks' AND v_plan.duration = '2y'  THEN 4.0
    WHEN v_plan.strategy = 'stocks' AND v_plan.duration = '3y'  THEN 4.5
    WHEN v_plan.strategy = 'stocks' AND v_plan.duration = '5y'  THEN 5.0
    WHEN v_plan.strategy = 'stocks' AND v_plan.duration = '10y' THEN 6.0
    ELSE 3.0
  END;
  v_profit := ROUND(
    v_principal * (
      POWER(1 + v_return / 100,
        CASE v_plan.duration
          WHEN '6m' THEN 0.5 WHEN '1y' THEN 1 WHEN '2y' THEN 2
          WHEN '3y' THEN 3   WHEN '5y' THEN 5 WHEN '10y' THEN 10
          ELSE 1
        END
      ) - 1
    ), 2
  );
  v_total := v_principal + v_profit;
  UPDATE profiles
    SET balance    = balance + v_total,
        updated_at = now()
    WHERE user_id = v_uid;
  UPDATE savings_goals
    SET status           = 'withdrawn',
        withdrawn_amount = v_total,
        withdrawn_at     = now(),
        saved_amount     = 0,
        updated_at       = now()
    WHERE id = v_plan.goal_id;
  UPDATE savings_auto_save
    SET settled    = true,
        is_active  = false,
        updated_at = now()
    WHERE id = p_plan_id;
  RETURN jsonb_build_object(
    'success',    true,
    'principal',  v_principal,
    'profit',     v_profit,
    'total',      v_total,
    'return_pct', v_return
  );
END;
$$;