
CREATE TABLE IF NOT EXISTS public.admin_role_permissions (
  role text NOT NULL,
  permission text NOT NULL,
  allowed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  PRIMARY KEY (role, permission)
);

GRANT SELECT ON public.admin_role_permissions TO authenticated;
GRANT ALL ON public.admin_role_permissions TO service_role;

ALTER TABLE public.admin_role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "arp_read_authenticated" ON public.admin_role_permissions;
CREATE POLICY "arp_read_authenticated" ON public.admin_role_permissions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "arp_write_admin" ON public.admin_role_permissions;
CREATE POLICY "arp_write_admin" ON public.admin_role_permissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.admin_role_permissions p
      ON p.role = ur.role::text
     AND p.permission = _permission
     AND p.allowed = true
    WHERE ur.user_id = _user_id
  )
  OR public.has_role(_user_id, 'admin'::app_role);
$$;

GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;

INSERT INTO public.admin_role_permissions(role, permission, allowed) VALUES
  ('admin', 'manage_distributors', true),
  ('admin', 'manage_super_distributors', true),
  ('admin', 'manage_agents', true),
  ('admin', 'manage_territories', true),
  ('admin', 'manage_roles', true),
  ('admin', 'view_audit_logs', true),
  ('operations', 'manage_distributors', true),
  ('operations', 'manage_agents', true),
  ('operations', 'manage_territories', true),
  ('operations', 'view_audit_logs', true),
  ('manager', 'manage_distributors', true),
  ('manager', 'manage_agents', true),
  ('manager', 'manage_super_distributors', true),
  ('compliance', 'view_audit_logs', true)
ON CONFLICT (role, permission) DO NOTHING;
