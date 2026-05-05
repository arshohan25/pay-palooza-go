CREATE TABLE IF NOT EXISTS public.dps_run_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID NOT NULL REFERENCES public.savings_auto_save(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  outcome TEXT NOT NULL,
  reason TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  triggered_by TEXT NOT NULL DEFAULT 'cron',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dps_run_log_schedule ON public.dps_run_log(schedule_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dps_run_log_user ON public.dps_run_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dps_run_log_created ON public.dps_run_log(created_at DESC);

ALTER TABLE public.dps_run_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own run log"
ON public.dps_run_log FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all run log"
ON public.dps_run_log FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.dps_run_log REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dps_run_log;