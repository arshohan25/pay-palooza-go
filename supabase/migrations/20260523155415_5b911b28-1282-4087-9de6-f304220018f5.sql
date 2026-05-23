CREATE TABLE IF NOT EXISTS public.savings_deposits (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id    UUID NOT NULL REFERENCES public.savings_goals(id) ON DELETE CASCADE,
  amount     NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  source     TEXT NOT NULL DEFAULT 'manual'
             CHECK (source IN ('manual','auto','dps_repay','opening')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.savings_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "savings_deposits_own_select" ON public.savings_deposits
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "savings_deposits_own_insert" ON public.savings_deposits
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "savings_deposits_own_delete" ON public.savings_deposits
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX savings_deposits_goal_idx ON public.savings_deposits(goal_id, created_at ASC);