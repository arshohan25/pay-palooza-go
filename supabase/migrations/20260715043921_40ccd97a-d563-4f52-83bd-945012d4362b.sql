
-- Realtime for approvals + presets
ALTER TABLE public.permission_change_requests REPLICA IDENTITY FULL;
ALTER TABLE public.admin_role_permission_presets REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.permission_change_requests; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_role_permission_presets; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- Preset version history
CREATE TABLE IF NOT EXISTS public.admin_role_permission_preset_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  preset_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  change_type TEXT NOT NULL,             -- 'created' | 'updated' | 'deleted' | 'restored'
  changed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_role_permission_preset_versions TO authenticated;
GRANT ALL ON public.admin_role_permission_preset_versions TO service_role;
ALTER TABLE public.admin_role_permission_preset_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read preset versions" ON public.admin_role_permission_preset_versions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'manage_roles'));
CREATE POLICY "admins insert preset versions" ON public.admin_role_permission_preset_versions
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'manage_roles'));

CREATE INDEX IF NOT EXISTS idx_preset_versions_preset ON public.admin_role_permission_preset_versions(preset_id, created_at DESC);

-- Snapshot trigger
CREATE OR REPLACE FUNCTION public.snapshot_preset_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ct TEXT;
  src RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN ct := 'deleted'; src := OLD;
  ELSIF TG_OP = 'INSERT' THEN ct := 'created'; src := NEW;
  ELSE ct := 'updated'; src := NEW;
  END IF;
  INSERT INTO public.admin_role_permission_preset_versions(
    preset_id, name, description, permissions, is_builtin, change_type, changed_by
  ) VALUES (src.id, src.name, src.description, src.permissions, src.is_builtin, ct, auth.uid());
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS preset_snapshot ON public.admin_role_permission_presets;
CREATE TRIGGER preset_snapshot
  AFTER INSERT OR UPDATE OR DELETE ON public.admin_role_permission_presets
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_preset_version();

-- Backfill an initial "created" version for any existing preset without history.
INSERT INTO public.admin_role_permission_preset_versions(
  preset_id, name, description, permissions, is_builtin, change_type
)
SELECT p.id, p.name, p.description, p.permissions, p.is_builtin, 'created'
FROM public.admin_role_permission_presets p
WHERE NOT EXISTS (
  SELECT 1 FROM public.admin_role_permission_preset_versions v WHERE v.preset_id = p.id
);

-- Restore a version: applies its content back onto the preset and logs the restore.
CREATE OR REPLACE FUNCTION public.restore_preset_version(_version_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v RECORD; is_admin BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  is_admin := public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'manage_roles');
  IF NOT is_admin THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO v FROM public.admin_role_permission_preset_versions WHERE id = _version_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Version not found'; END IF;

  -- Re-create or update the preset from the version snapshot.
  INSERT INTO public.admin_role_permission_presets(id, name, description, permissions, is_builtin)
  VALUES (v.preset_id, v.name, v.description, v.permissions, v.is_builtin)
  ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        description = EXCLUDED.description,
        permissions = EXCLUDED.permissions,
        updated_at = now();

  INSERT INTO public.admin_role_permission_preset_versions(
    preset_id, name, description, permissions, is_builtin, change_type, changed_by
  ) VALUES (v.preset_id, v.name, v.description, v.permissions, v.is_builtin, 'restored', auth.uid());

  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'preset_restored', 'preset', NULL,
          jsonb_build_object('preset_id', v.preset_id, 'version_id', _version_id, 'name', v.name));
END;
$$;
GRANT EXECUTE ON FUNCTION public.restore_preset_version(UUID) TO authenticated;
