CREATE TABLE IF NOT EXISTS public.savings_goals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  emoji            TEXT NOT NULL DEFAULT '🎯',
  target_amount    NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (target_amount >= 0),
  saved_amount     NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (saved_amount >= 0),
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','completed','withdrawn','cancelled')),
  withdrawn_amount NUMERIC(15,2) DEFAULT 0,
  withdrawn_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "savings_goals_own_select" ON public.savings_goals
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "savings_goals_own_insert" ON public.savings_goals
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "savings_goals_own_update" ON public.savings_goals
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "savings_goals_own_delete" ON public.savings_goals
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS savings_goals_user_idx ON public.savings_goals(user_id, status, created_at DESC);

CREATE TRIGGER savings_goals_updated_at
BEFORE UPDATE ON public.savings_goals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();