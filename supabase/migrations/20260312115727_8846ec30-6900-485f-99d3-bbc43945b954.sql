
-- 1. savings_goals table
CREATE TABLE IF NOT EXISTS public.savings_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🎯',
  target_amount NUMERIC NOT NULL DEFAULT 0,
  saved_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own savings goals"
ON public.savings_goals FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins read all savings goals"
ON public.savings_goals FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2. savings_deposits table
CREATE TABLE IF NOT EXISTS public.savings_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.savings_goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.savings_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own savings deposits"
ON public.savings_deposits FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins read all savings deposits"
ON public.savings_deposits FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3. savings_auto_save table
CREATE TABLE IF NOT EXISTS public.savings_auto_save (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  goal_id UUID REFERENCES public.savings_goals(id) ON DELETE SET NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  amount NUMERIC NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '1 day',
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.savings_auto_save ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own auto save"
ON public.savings_auto_save FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins read all auto save"
ON public.savings_auto_save FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 4. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.savings_goals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.savings_deposits;

-- 5. savings_deposit RPC
CREATE OR REPLACE FUNCTION public.savings_deposit(
  p_goal_id UUID,
  p_amount NUMERIC,
  p_source TEXT DEFAULT 'manual'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  -- Lock user balance
  SELECT balance INTO v_balance FROM profiles WHERE user_id = v_user_id FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF v_balance < p_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  -- Lock goal
  SELECT * INTO v_goal FROM savings_goals WHERE id = p_goal_id AND user_id = v_user_id FOR UPDATE;
  IF v_goal.id IS NULL THEN RAISE EXCEPTION 'Goal not found'; END IF;
  IF v_goal.status != 'active' THEN RAISE EXCEPTION 'Goal is not active'; END IF;

  -- Deduct from wallet
  v_new_balance := v_balance - p_amount;
  UPDATE profiles SET balance = v_new_balance WHERE user_id = v_user_id;

  -- Credit to goal
  v_new_saved := v_goal.saved_amount + p_amount;
  IF v_new_saved >= v_goal.target_amount THEN
    v_goal_completed := true;
    UPDATE savings_goals SET saved_amount = v_new_saved, status = 'completed', updated_at = now() WHERE id = p_goal_id;
  ELSE
    UPDATE savings_goals SET saved_amount = v_new_saved, updated_at = now() WHERE id = p_goal_id;
  END IF;

  -- Insert deposit record
  INSERT INTO savings_deposits (goal_id, user_id, amount, source) VALUES (p_goal_id, v_user_id, p_amount, p_source);

  RETURN json_build_object(
    'success', true,
    'wallet_balance', v_new_balance,
    'goal_saved', v_new_saved,
    'goal_completed', v_goal_completed
  );
END;
$$;
