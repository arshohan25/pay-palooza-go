ALTER TABLE public.dps_run_log
  ADD COLUMN IF NOT EXISTS goal_id uuid,
  ADD COLUMN IF NOT EXISTS goal_name text,
  ADD COLUMN IF NOT EXISTS tx_reference text,
  ADD COLUMN IF NOT EXISTS transaction_id uuid;

CREATE INDEX IF NOT EXISTS idx_dps_run_log_created_at ON public.dps_run_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dps_run_log_outcome ON public.dps_run_log(outcome);
CREATE INDEX IF NOT EXISTS idx_dps_run_log_user_id ON public.dps_run_log(user_id);