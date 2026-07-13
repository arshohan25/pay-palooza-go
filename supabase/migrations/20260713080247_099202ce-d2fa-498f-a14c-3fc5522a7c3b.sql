
CREATE TABLE public.role_redirect_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  attempted_app_role TEXT NOT NULL,
  user_roles TEXT[] NOT NULL DEFAULT '{}',
  path TEXT NOT NULL,
  reason TEXT NOT NULL,
  is_authenticated BOOLEAN NOT NULL DEFAULT false,
  user_agent TEXT
);

CREATE INDEX role_redirect_logs_created_at_idx ON public.role_redirect_logs (created_at DESC);
CREATE INDEX role_redirect_logs_attempted_role_idx ON public.role_redirect_logs (attempted_app_role, created_at DESC);

GRANT INSERT ON public.role_redirect_logs TO anon, authenticated;
GRANT SELECT ON public.role_redirect_logs TO authenticated;
GRANT ALL ON public.role_redirect_logs TO service_role;

ALTER TABLE public.role_redirect_logs ENABLE ROW LEVEL SECURITY;

-- Anyone (including unauthenticated visitors of a role-bound PWA) can insert
-- their own redirect attempt. Rows carry only the URL, the attempted role, and
-- (if signed in) the user's own id/roles — no PII beyond user_agent.
CREATE POLICY "Anyone can log a redirect attempt"
  ON public.role_redirect_logs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- Only admins/audit staff can review the log.
CREATE POLICY "Admins can review redirect logs"
  ON public.role_redirect_logs
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'audit')
    OR public.has_role(auth.uid(), 'compliance')
  );
