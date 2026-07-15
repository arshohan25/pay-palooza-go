
-- Role permission presets: reusable bundles admins can apply to a role.
CREATE TABLE public.admin_role_permission_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb, -- array of permission keys
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_role_permission_presets TO authenticated;
GRANT ALL ON public.admin_role_permission_presets TO service_role;
ALTER TABLE public.admin_role_permission_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read presets" ON public.admin_role_permission_presets
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'manage_roles'));
CREATE POLICY "admins write presets" ON public.admin_role_permission_presets
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'manage_roles'));
CREATE POLICY "admins update presets" ON public.admin_role_permission_presets
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'manage_roles'));
CREATE POLICY "admins delete non-builtin" ON public.admin_role_permission_presets
  FOR DELETE TO authenticated
  USING ((public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'manage_roles')) AND is_builtin = false);

-- Seed built-in presets.
INSERT INTO public.admin_role_permission_presets (name, description, permissions, is_builtin) VALUES
  ('Read-only Auditor', 'View audit logs; no mutations.', '["view_audit_logs"]'::jsonb, true),
  ('Network Operations', 'Manage distributors, agents, territories.', '["manage_distributors","manage_agents","manage_territories"]'::jsonb, true),
  ('Network Lead', 'Full network + super distributor management.', '["manage_distributors","manage_super_distributors","manage_agents","manage_territories","view_audit_logs"]'::jsonb, true),
  ('Full Access', 'Every registered permission.', '["manage_distributors","manage_super_distributors","manage_agents","manage_territories","manage_roles","view_audit_logs"]'::jsonb, true)
ON CONFLICT (name) DO NOTHING;

-- Second-admin approval workflow for high-risk permission changes.
CREATE TYPE public.perm_change_status AS ENUM ('pending','approved','rejected','cancelled');

CREATE TABLE public.permission_change_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role TEXT NOT NULL,
  permission TEXT NOT NULL,
  allowed BOOLEAN NOT NULL,
  reason TEXT,
  status public.perm_change_status NOT NULL DEFAULT 'pending',
  requested_by UUID NOT NULL,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permission_change_requests TO authenticated;
GRANT ALL ON public.permission_change_requests TO service_role;
ALTER TABLE public.permission_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read requests" ON public.permission_change_requests
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'manage_roles'));
CREATE POLICY "admins create requests" ON public.permission_change_requests
  FOR INSERT TO authenticated
  WITH CHECK ((public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'manage_roles')) AND requested_by = auth.uid());
CREATE POLICY "admins review requests" ON public.permission_change_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'manage_roles'));

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER perm_change_touch BEFORE UPDATE ON public.permission_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER preset_touch BEFORE UPDATE ON public.admin_role_permission_presets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Approve a pending request: requires a DIFFERENT admin than requester.
CREATE OR REPLACE FUNCTION public.approve_permission_change(_request_id UUID, _note TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.permission_change_requests%ROWTYPE;
  is_admin BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  is_admin := public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'manage_roles');
  IF NOT is_admin THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO req FROM public.permission_change_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'Request is not pending'; END IF;
  IF req.requested_by = auth.uid() THEN
    RAISE EXCEPTION 'A second admin must approve — the requester cannot self-approve';
  END IF;

  INSERT INTO public.admin_role_permissions(role, permission, allowed, updated_at, updated_by)
  VALUES (req.role, req.permission, req.allowed, now(), auth.uid())
  ON CONFLICT (role, permission) DO UPDATE
    SET allowed = EXCLUDED.allowed, updated_at = now(), updated_by = auth.uid();

  UPDATE public.permission_change_requests
    SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), review_note = _note
    WHERE id = _request_id;

  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), CASE WHEN req.allowed THEN 'permission_granted' ELSE 'permission_revoked' END,
          'permission', NULL,
          jsonb_build_object('role', req.role, 'permission', req.permission, 'allowed', req.allowed,
                             'approved_request', _request_id, 'requested_by', req.requested_by));
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_permission_change(_request_id UUID, _note TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.permission_change_requests%ROWTYPE;
  is_admin BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  is_admin := public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'manage_roles');
  IF NOT is_admin THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO req FROM public.permission_change_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'Request is not pending'; END IF;

  UPDATE public.permission_change_requests
    SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_note = _note
    WHERE id = _request_id;

  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'permission_change_rejected', 'permission', NULL,
          jsonb_build_object('role', req.role, 'permission', req.permission, 'allowed', req.allowed,
                             'request_id', _request_id, 'note', _note));
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_permission_change(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_permission_change(UUID, TEXT) TO authenticated;
