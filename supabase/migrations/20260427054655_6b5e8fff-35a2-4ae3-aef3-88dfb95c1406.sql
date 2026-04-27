CREATE TABLE IF NOT EXISTS public.admin_daily_metrics_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL UNIQUE,
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by uuid,
  cohorts jsonb NOT NULL DEFAULT '{}'::jsonb,
  predictive jsonb NOT NULL DEFAULT '{}'::jsonb,
  ops_wall jsonb NOT NULL DEFAULT '{}'::jsonb,
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_daily_metrics_snapshots_date
  ON public.admin_daily_metrics_snapshots (snapshot_date DESC);

ALTER TABLE public.admin_daily_metrics_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin staff can view metric snapshots"
  ON public.admin_daily_metrics_snapshots
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'compliance'::app_role)
    OR has_role(auth.uid(), 'risk'::app_role)
    OR has_role(auth.uid(), 'audit'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  );

CREATE POLICY "No direct writes to metric snapshots"
  ON public.admin_daily_metrics_snapshots
  FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE TRIGGER trg_admin_daily_metrics_snapshots_updated_at
  BEFORE UPDATE ON public.admin_daily_metrics_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();