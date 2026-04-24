CREATE OR REPLACE FUNCTION public.is_admin_command_staff(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
    OR public.has_role(_user_id, 'compliance')
    OR public.has_role(_user_id, 'finance')
    OR public.has_role(_user_id, 'support')
    OR public.has_role(_user_id, 'operations')
    OR public.has_role(_user_id, 'marketing')
    OR public.has_role(_user_id, 'hr')
    OR public.has_role(_user_id, 'audit')
    OR public.has_role(_user_id, 'risk')
    OR public.has_role(_user_id, 'developer')
    OR public.has_role(_user_id, 'manager')
$$;

CREATE TABLE IF NOT EXISTS public.admin_user_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL,
  note_type TEXT NOT NULL DEFAULT 'general',
  note TEXT NOT NULL,
  assigned_staff_id UUID,
  follow_up_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open',
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_user_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  segment_key TEXT NOT NULL UNIQUE,
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  estimated_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_bulk_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  target_user_ids UUID[] NOT NULL DEFAULT '{}',
  target_segment_id UUID,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  rollback_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  requested_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_by UUID NOT NULL DEFAULT auth.uid(),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  decision_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_security_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'access',
  severity TEXT NOT NULL DEFAULT 'medium',
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_sensitive_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL DEFAULT auth.uid(),
  target_user_id UUID,
  data_type TEXT NOT NULL,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_evidence_vault (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_title TEXT NOT NULL,
  case_type TEXT NOT NULL DEFAULT 'investigation',
  related_user_id UUID,
  evidence_type TEXT NOT NULL DEFAULT 'note',
  evidence_hash TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_dashboard_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL DEFAULT auth.uid(),
  department TEXT NOT NULL DEFAULT 'operations',
  role_key TEXT,
  layout JSONB NOT NULL DEFAULT '{}'::jsonb,
  favorite_modules TEXT[] NOT NULL DEFAULT '{}',
  saved_filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_user_id, department)
);

CREATE TABLE IF NOT EXISTS public.admin_launch_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key TEXT NOT NULL,
  title TEXT NOT NULL,
  owner TEXT,
  preview_date DATE,
  live_date DATE,
  dependency_status TEXT NOT NULL DEFAULT 'pending',
  business_impact TEXT,
  rollback_plan TEXT,
  launch_notes TEXT,
  status TEXT NOT NULL DEFAULT 'planned',
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'transactional',
  channel TEXT NOT NULL DEFAULT 'sms',
  subject_en TEXT,
  body_en TEXT NOT NULL,
  subject_bn TEXT,
  body_bn TEXT,
  variables TEXT[] NOT NULL DEFAULT '{}',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_user_notes_target ON public.admin_user_notes(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_approval_status ON public.admin_approval_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_sensitive_access_actor ON public.admin_sensitive_access_logs(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_evidence_related_user ON public.admin_evidence_vault(related_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_launch_feature ON public.admin_launch_calendar(feature_key);

CREATE OR REPLACE FUNCTION public.admin_command_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_admin_user_notes_updated_at ON public.admin_user_notes;
CREATE TRIGGER set_admin_user_notes_updated_at BEFORE UPDATE ON public.admin_user_notes FOR EACH ROW EXECUTE FUNCTION public.admin_command_updated_at();
DROP TRIGGER IF EXISTS set_admin_user_segments_updated_at ON public.admin_user_segments;
CREATE TRIGGER set_admin_user_segments_updated_at BEFORE UPDATE ON public.admin_user_segments FOR EACH ROW EXECUTE FUNCTION public.admin_command_updated_at();
DROP TRIGGER IF EXISTS set_admin_bulk_actions_updated_at ON public.admin_bulk_actions;
CREATE TRIGGER set_admin_bulk_actions_updated_at BEFORE UPDATE ON public.admin_bulk_actions FOR EACH ROW EXECUTE FUNCTION public.admin_command_updated_at();
DROP TRIGGER IF EXISTS set_admin_approval_requests_updated_at ON public.admin_approval_requests;
CREATE TRIGGER set_admin_approval_requests_updated_at BEFORE UPDATE ON public.admin_approval_requests FOR EACH ROW EXECUTE FUNCTION public.admin_command_updated_at();
DROP TRIGGER IF EXISTS set_admin_security_policies_updated_at ON public.admin_security_policies;
CREATE TRIGGER set_admin_security_policies_updated_at BEFORE UPDATE ON public.admin_security_policies FOR EACH ROW EXECUTE FUNCTION public.admin_command_updated_at();
DROP TRIGGER IF EXISTS set_admin_evidence_vault_updated_at ON public.admin_evidence_vault;
CREATE TRIGGER set_admin_evidence_vault_updated_at BEFORE UPDATE ON public.admin_evidence_vault FOR EACH ROW EXECUTE FUNCTION public.admin_command_updated_at();
DROP TRIGGER IF EXISTS set_admin_dashboard_layouts_updated_at ON public.admin_dashboard_layouts;
CREATE TRIGGER set_admin_dashboard_layouts_updated_at BEFORE UPDATE ON public.admin_dashboard_layouts FOR EACH ROW EXECUTE FUNCTION public.admin_command_updated_at();
DROP TRIGGER IF EXISTS set_admin_launch_calendar_updated_at ON public.admin_launch_calendar;
CREATE TRIGGER set_admin_launch_calendar_updated_at BEFORE UPDATE ON public.admin_launch_calendar FOR EACH ROW EXECUTE FUNCTION public.admin_command_updated_at();
DROP TRIGGER IF EXISTS set_notification_templates_updated_at ON public.notification_templates;
CREATE TRIGGER set_notification_templates_updated_at BEFORE UPDATE ON public.notification_templates FOR EACH ROW EXECUTE FUNCTION public.admin_command_updated_at();

ALTER TABLE public.admin_user_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_user_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_bulk_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_security_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sensitive_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_evidence_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_dashboard_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_launch_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authorized staff can manage admin user notes" ON public.admin_user_notes;
CREATE POLICY "Authorized staff can manage admin user notes" ON public.admin_user_notes FOR ALL TO authenticated USING (public.is_admin_command_staff()) WITH CHECK (public.is_admin_command_staff());
DROP POLICY IF EXISTS "Authorized staff can manage user segments" ON public.admin_user_segments;
CREATE POLICY "Authorized staff can manage user segments" ON public.admin_user_segments FOR ALL TO authenticated USING (public.is_admin_command_staff()) WITH CHECK (public.is_admin_command_staff());
DROP POLICY IF EXISTS "Authorized staff can manage bulk actions" ON public.admin_bulk_actions;
CREATE POLICY "Authorized staff can manage bulk actions" ON public.admin_bulk_actions FOR ALL TO authenticated USING (public.is_admin_command_staff()) WITH CHECK (public.is_admin_command_staff());
DROP POLICY IF EXISTS "Authorized staff can manage approval requests" ON public.admin_approval_requests;
CREATE POLICY "Authorized staff can manage approval requests" ON public.admin_approval_requests FOR ALL TO authenticated USING (public.is_admin_command_staff()) WITH CHECK (public.is_admin_command_staff());
DROP POLICY IF EXISTS "Authorized staff can manage security policies" ON public.admin_security_policies;
CREATE POLICY "Authorized staff can manage security policies" ON public.admin_security_policies FOR ALL TO authenticated USING (public.is_admin_command_staff()) WITH CHECK (public.is_admin_command_staff());
DROP POLICY IF EXISTS "Authorized staff can create sensitive access logs" ON public.admin_sensitive_access_logs;
CREATE POLICY "Authorized staff can create sensitive access logs" ON public.admin_sensitive_access_logs FOR INSERT TO authenticated WITH CHECK (public.is_admin_command_staff() AND actor_id = auth.uid());
DROP POLICY IF EXISTS "Audit roles can view sensitive access logs" ON public.admin_sensitive_access_logs;
CREATE POLICY "Audit roles can view sensitive access logs" ON public.admin_sensitive_access_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'audit') OR public.has_role(auth.uid(), 'risk') OR public.has_role(auth.uid(), 'compliance'));
DROP POLICY IF EXISTS "Authorized staff can manage evidence vault" ON public.admin_evidence_vault;
CREATE POLICY "Authorized staff can manage evidence vault" ON public.admin_evidence_vault FOR ALL TO authenticated USING (public.is_admin_command_staff()) WITH CHECK (public.is_admin_command_staff());
DROP POLICY IF EXISTS "Staff can manage own dashboard layouts" ON public.admin_dashboard_layouts;
CREATE POLICY "Staff can manage own dashboard layouts" ON public.admin_dashboard_layouts FOR ALL TO authenticated USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')) WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Authorized staff can manage launch calendar" ON public.admin_launch_calendar;
CREATE POLICY "Authorized staff can manage launch calendar" ON public.admin_launch_calendar FOR ALL TO authenticated USING (public.is_admin_command_staff()) WITH CHECK (public.is_admin_command_staff());
DROP POLICY IF EXISTS "Authorized staff can manage notification templates" ON public.notification_templates;
CREATE POLICY "Authorized staff can manage notification templates" ON public.notification_templates FOR ALL TO authenticated USING (public.is_admin_command_staff()) WITH CHECK (public.is_admin_command_staff());