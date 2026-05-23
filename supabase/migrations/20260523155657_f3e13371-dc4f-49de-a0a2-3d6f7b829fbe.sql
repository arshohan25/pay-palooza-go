CREATE TABLE IF NOT EXISTS public.dps_run_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id  UUID NOT NULL REFERENCES public.savings_auto_save(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id      UUID REFERENCES public.savings_goals(id) ON DELETE SET NULL,
  goal_name    TEXT,
  amount       NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  outcome      TEXT NOT NULL
               CHECK (outcome IN (
                 'collected','missed','dedup_skipped','plan_expired',
                 'no_goal','schedule_inactive','settled'
               )),
  tx_reference TEXT,
  reason       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dps_run_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dps_run_log_own_select" ON public.dps_run_log
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "dps_run_log_own_insert" ON public.dps_run_log
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "dps_run_log_own_delete" ON public.dps_run_log
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX dps_run_log_schedule_idx ON public.dps_run_log(schedule_id, created_at ASC);