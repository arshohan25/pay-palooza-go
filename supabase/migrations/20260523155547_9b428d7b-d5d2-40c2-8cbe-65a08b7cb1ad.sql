CREATE TABLE IF NOT EXISTS public.savings_auto_save (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id            UUID REFERENCES public.savings_goals(id) ON DELETE SET NULL,
  frequency          TEXT NOT NULL DEFAULT 'monthly'
                     CHECK (frequency IN ('daily','weekly','monthly')),
  amount             NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  strategy           TEXT NOT NULL DEFAULT 'gold'
                     CHECK (strategy IN ('gold','mixed','stocks')),
  duration           TEXT NOT NULL DEFAULT '1y'
                     CHECK (duration IN ('6m','1y','2y','3y','5y','10y')),
  is_active          BOOLEAN NOT NULL DEFAULT true,
  settled            BOOLEAN NOT NULL DEFAULT false,
  next_run_at        TIMESTAMPTZ NOT NULL,
  ends_at            TIMESTAMPTZ,
  last_run_at        TIMESTAMPTZ,
  total_installments INT NOT NULL DEFAULT 0 CHECK (total_installments >= 0),
  total_paid         INT NOT NULL DEFAULT 0 CHECK (total_paid >= 0),
  missed_count       INT NOT NULL DEFAULT 0 CHECK (missed_count >= 0),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.savings_auto_save ENABLE ROW LEVEL SECURITY;

CREATE POLICY "savings_auto_save_own_select" ON public.savings_auto_save
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "savings_auto_save_own_insert" ON public.savings_auto_save
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "savings_auto_save_own_update" ON public.savings_auto_save
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "savings_auto_save_own_delete" ON public.savings_auto_save
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX savings_auto_save_due_idx ON public.savings_auto_save(is_active, settled, next_run_at)
  WHERE is_active = true AND settled = false;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER savings_auto_save_updated_at
  BEFORE UPDATE ON public.savings_auto_save
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();