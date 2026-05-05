
DO $$
DECLARE
  v_user uuid := '897da592-d434-4db9-8c84-665d36b97e77';
  v_schedule uuid := 'df417dd2-8fbc-4ec0-8da1-cf10f18efe5f';
  v_bike_goal uuid := '9054694e-b944-46cd-8863-26ce8b83f4ea';
  v_new_goal uuid;
  v_balance numeric;
BEGIN
  -- 1. Reverse Bike goal credit (#1 cron run misrouted to Bike)
  UPDATE public.savings_goals
  SET saved_amount = GREATEST(0, saved_amount - 1000),
      updated_at = now()
  WHERE id = v_bike_goal;

  DELETE FROM public.savings_deposits
  WHERE id = '25fffb88-5c17-4f32-8549-2cce9ac77b63';

  -- 2. Refund both ৳1,000 installments to wallet (DPS Plan #1 + Bike #1)
  SELECT balance INTO v_balance FROM public.profiles WHERE user_id = v_user FOR UPDATE;
  UPDATE public.profiles
  SET balance = balance + 2000, updated_at = now()
  WHERE user_id = v_user;

  -- 3. Mark original transactions reversed (audit trail)
  UPDATE public.transactions
  SET status = 'reversed',
      description = description || ' [REVERSED: orphaned, refunded]'
  WHERE id IN (
    'c003117a-3bd0-4738-8818-bb2cefda546d',
    'f8030b47-f076-46b4-81e5-6f88e95c7634'
  );

  -- 4. Insert refund transaction record
  INSERT INTO public.transactions (
    user_id, type, amount, fee, description, reference, status, balance_after
  ) VALUES (
    v_user, 'receive', 2000, 0,
    'Refund: 2 misrouted DPS installments (DPS Plan #1, Bike #1)',
    'DPS-REFUND-' || substr(v_schedule::text, 1, 8),
    'completed', v_balance + 2000
  );

  -- 5. Create a proper "DPS Plan" holding goal and link the schedule to it
  INSERT INTO public.savings_goals (user_id, name, emoji, target_amount, saved_amount, status)
  VALUES (v_user, 'DPS Plan', '💰', 52000, 0, 'active')
  RETURNING id INTO v_new_goal;

  UPDATE public.savings_auto_save
  SET goal_id = v_new_goal,
      total_paid = 0,
      last_run_at = NULL,
      next_run_at = now() + interval '7 days',
      updated_at = now()
  WHERE id = v_schedule;

  -- 6. Notify user
  INSERT INTO public.notifications (user_id, title, body, category)
  VALUES (
    v_user,
    '💸 ৳2,000 Refunded',
    'Two DPS installments were not linked to a savings goal and have been refunded to your wallet. Your weekly DPS plan is now linked to a new "DPS Plan" goal and will collect normally next cycle.',
    'savings'
  );
END $$;
