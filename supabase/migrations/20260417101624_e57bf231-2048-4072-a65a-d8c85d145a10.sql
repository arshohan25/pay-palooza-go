CREATE OR REPLACE FUNCTION public.withdraw_completed_goal(p_goal_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE 
  v_user uuid; 
  v_goal record; 
  v_new_bal numeric;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  
  SELECT * INTO v_goal FROM public.savings_goals 
    WHERE id = p_goal_id AND user_id = v_user FOR UPDATE;
  IF v_goal.id IS NULL THEN RAISE EXCEPTION 'Goal not found'; END IF;
  IF v_goal.status <> 'completed' THEN RAISE EXCEPTION 'Goal not completed yet'; END IF;
  IF COALESCE(v_goal.saved_amount, 0) <= 0 THEN RAISE EXCEPTION 'Nothing to withdraw'; END IF;

  UPDATE public.profiles SET balance = COALESCE(balance, 0) + v_goal.saved_amount
    WHERE user_id = v_user RETURNING balance INTO v_new_bal;
    
  UPDATE public.savings_goals 
    SET saved_amount = 0, status = 'withdrawn', updated_at = now()
    WHERE id = p_goal_id;
    
  INSERT INTO public.transactions(user_id, type, amount, fee, balance_after, description, reference, status, short_id)
    VALUES (
      v_user, 'addmoney', v_goal.saved_amount, 0, v_new_bal,
      'Goal Withdrawal: ' || v_goal.name,
      'GOAL-WD-' || upper(substring(gen_random_uuid()::text, 1, 8)),
      'completed', 
      upper(substring(gen_random_uuid()::text, 1, 12))
    );
    
  RETURN json_build_object('success', true, 'amount', v_goal.saved_amount, 'balance', v_new_bal);
END $$;

CREATE OR REPLACE FUNCTION public.settle_matured_dps(p_plan_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE 
  v_user uuid; 
  v_p record; 
  v_principal numeric; 
  v_profit numeric; 
  v_total numeric; 
  v_new_bal numeric;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  
  SELECT * INTO v_p FROM public.savings_auto_save 
    WHERE id = p_plan_id AND user_id = v_user FOR UPDATE;
  IF v_p.id IS NULL THEN RAISE EXCEPTION 'Plan not found'; END IF;
  IF COALESCE(v_p.settled, false) THEN RAISE EXCEPTION 'Plan already settled'; END IF;
  IF v_p.ends_at IS NULL OR v_p.ends_at > now() THEN RAISE EXCEPTION 'Plan not matured yet'; END IF;

  v_principal := COALESCE(v_p.amount, 0) * COALESCE(v_p.total_paid, 0);
  IF v_principal <= 0 THEN RAISE EXCEPTION 'No principal to settle'; END IF;
  
  v_profit := round(v_principal * 0.05, 2);
  v_total := v_principal + v_profit;

  UPDATE public.profiles SET balance = COALESCE(balance, 0) + v_total
    WHERE user_id = v_user RETURNING balance INTO v_new_bal;
    
  UPDATE public.savings_auto_save 
    SET settled = true, is_active = false, updated_at = now() 
    WHERE id = p_plan_id;
    
  INSERT INTO public.transactions(user_id, type, amount, fee, balance_after, description, reference, status, short_id)
    VALUES (
      v_user, 'addmoney', v_total, 0, v_new_bal,
      'DPS Maturity Payout (incl. ৳' || v_profit || ' profit)',
      'DPS-MAT-' || upper(substring(gen_random_uuid()::text, 1, 8)),
      'completed',
      upper(substring(gen_random_uuid()::text, 1, 12))
    );
    
  RETURN json_build_object(
    'success', true, 
    'principal', v_principal, 
    'profit', v_profit, 
    'total', v_total, 
    'balance', v_new_bal
  );
END $$;