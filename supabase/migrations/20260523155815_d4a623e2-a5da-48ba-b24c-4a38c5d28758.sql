CREATE TABLE IF NOT EXISTS public.dps_missed_payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.savings_auto_save(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  due_date    TIMESTAMPTZ NOT NULL,
  repaid      BOOLEAN NOT NULL DEFAULT false,
  repaid_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dps_missed_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dps_missed_payments_own_select" ON public.dps_missed_payments
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "dps_missed_payments_own_insert" ON public.dps_missed_payments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "dps_missed_payments_own_update" ON public.dps_missed_payments
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "dps_missed_payments_own_delete" ON public.dps_missed_payments
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX dps_missed_schedule_idx ON public.dps_missed_payments(schedule_id, repaid, due_date);