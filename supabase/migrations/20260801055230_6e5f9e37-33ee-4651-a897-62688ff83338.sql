-- 1. Incident / maintenance mode
CREATE TABLE public.platform_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  severity text NOT NULL DEFAULT 'info',
  scope text NOT NULL DEFAULT 'all',
  read_only boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_incidents TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_incidents TO authenticated;
GRANT ALL ON public.platform_incidents TO service_role;
ALTER TABLE public.platform_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active incidents" ON public.platform_incidents
  FOR SELECT USING (is_active = true AND (ends_at IS NULL OR ends_at > now()));
CREATE POLICY "Admins can read all incidents" ON public.platform_incidents
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert incidents" ON public.platform_incidents
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update incidents" ON public.platform_incidents
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete incidents" ON public.platform_incidents
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 2. Scheduled reports
CREATE TABLE public.admin_scheduled_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_key text NOT NULL,
  label text NOT NULL DEFAULT '',
  frequency text NOT NULL DEFAULT 'weekly',
  recipients text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_scheduled_reports TO authenticated;
GRANT ALL ON public.admin_scheduled_reports TO service_role;
ALTER TABLE public.admin_scheduled_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage scheduled reports" ON public.admin_scheduled_reports
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.admin_scheduled_report_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.admin_scheduled_reports(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  row_count integer NOT NULL DEFAULT 0,
  csv_content text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_scheduled_report_runs TO authenticated;
GRANT ALL ON public.admin_scheduled_report_runs TO service_role;
ALTER TABLE public.admin_scheduled_report_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read report runs" ON public.admin_scheduled_report_runs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 3. View-as-user audit trail
CREATE TABLE public.admin_view_as_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  reason text NOT NULL DEFAULT '',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.admin_view_as_sessions TO authenticated;
GRANT ALL ON public.admin_view_as_sessions TO service_role;
ALTER TABLE public.admin_view_as_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read view-as sessions" ON public.admin_view_as_sessions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins create view-as sessions" ON public.admin_view_as_sessions
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND admin_id = auth.uid());
CREATE POLICY "Admins close own view-as sessions" ON public.admin_view_as_sessions
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') AND admin_id = auth.uid());

-- updated_at triggers
CREATE TRIGGER trg_platform_incidents_updated_at BEFORE UPDATE ON public.platform_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_admin_scheduled_reports_updated_at BEFORE UPDATE ON public.admin_scheduled_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();