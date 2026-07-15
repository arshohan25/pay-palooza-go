
-- 1. Configurable undo window per role
CREATE TABLE IF NOT EXISTS public.admin_role_undo_windows (
  role text PRIMARY KEY,
  undo_seconds integer NOT NULL DEFAULT 900,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.admin_role_undo_windows TO authenticated;
GRANT ALL ON public.admin_role_undo_windows TO service_role;
ALTER TABLE public.admin_role_undo_windows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read undo windows" ON public.admin_role_undo_windows FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_permission(auth.uid(),'manage_roles'));
CREATE POLICY "Admins manage undo windows" ON public.admin_role_undo_windows FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_permission(auth.uid(),'manage_roles'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_permission(auth.uid(),'manage_roles'));

INSERT INTO public.admin_role_undo_windows(role, undo_seconds) VALUES
  ('admin', 900), ('manager', 900), ('operations', 900), ('compliance', 1800),
  ('finance', 900), ('support', 900), ('marketing', 900), ('hr', 900),
  ('audit', 1800), ('risk', 1800), ('developer', 900)
ON CONFLICT (role) DO NOTHING;

-- 2. Undo columns + snapshot on permission_change_requests
ALTER TABLE public.permission_change_requests
  ADD COLUMN IF NOT EXISTS snapshot_before_allowed boolean,
  ADD COLUMN IF NOT EXISTS undone_at timestamptz,
  ADD COLUMN IF NOT EXISTS undone_by uuid,
  ADD COLUMN IF NOT EXISTS undo_note text;

-- 3. Escalation opt-in on notification settings
ALTER TABLE public.user_notification_settings
  ADD COLUMN IF NOT EXISTS permission_escalation_opt_in boolean NOT NULL DEFAULT true;

-- 4. Rewrite approve to capture snapshot
CREATE OR REPLACE FUNCTION public.approve_permission_change(_request_id uuid, _note text DEFAULT NULL::text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  req public.permission_change_requests%ROWTYPE;
  is_admin boolean;
  before_val boolean;
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

  SELECT allowed INTO before_val FROM public.admin_role_permissions
    WHERE role = req.role AND permission = req.permission;
  before_val := COALESCE(before_val, false);

  INSERT INTO public.admin_role_permissions(role, permission, allowed, updated_at, updated_by)
  VALUES (req.role, req.permission, req.allowed, now(), auth.uid())
  ON CONFLICT (role, permission) DO UPDATE
    SET allowed = EXCLUDED.allowed, updated_at = now(), updated_by = auth.uid();

  UPDATE public.permission_change_requests
    SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(),
        review_note = _note, snapshot_before_allowed = before_val
    WHERE id = _request_id;

  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), CASE WHEN req.allowed THEN 'permission_granted' ELSE 'permission_revoked' END,
          'permission', NULL,
          jsonb_build_object('role', req.role, 'permission', req.permission, 'allowed', req.allowed,
                             'before', before_val,
                             'approved_request', _request_id, 'requested_by', req.requested_by,
                             'note', _note));
END; $$;

-- 5. Rewrite reject to capture snapshot
CREATE OR REPLACE FUNCTION public.reject_permission_change(_request_id uuid, _note text DEFAULT NULL::text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  req public.permission_change_requests%ROWTYPE;
  is_admin boolean;
  before_val boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  is_admin := public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'manage_roles');
  IF NOT is_admin THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO req FROM public.permission_change_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'Request is not pending'; END IF;

  SELECT allowed INTO before_val FROM public.admin_role_permissions
    WHERE role = req.role AND permission = req.permission;
  before_val := COALESCE(before_val, false);

  UPDATE public.permission_change_requests
    SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
        review_note = _note, snapshot_before_allowed = before_val
    WHERE id = _request_id;

  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'permission_change_rejected', 'permission', NULL,
          jsonb_build_object('role', req.role, 'permission', req.permission, 'allowed', req.allowed,
                             'before', before_val,
                             'request_id', _request_id, 'note', _note));
END; $$;

-- 6. Undo RPC — reverses an approve/reject within the role's configured window.
CREATE OR REPLACE FUNCTION public.undo_permission_change(_request_id uuid, _note text DEFAULT NULL::text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  req public.permission_change_requests%ROWTYPE;
  is_admin boolean;
  window_seconds integer;
  age_seconds integer;
  cur_allowed boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  is_admin := public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'manage_roles');
  IF NOT is_admin THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO req FROM public.permission_change_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF req.status NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'Only approved or rejected requests can be undone (current: %)', req.status;
  END IF;
  IF req.reviewed_by <> auth.uid() THEN
    RAISE EXCEPTION 'Only the reviewing admin (%) can undo this action', req.reviewed_by;
  END IF;
  IF req.undone_at IS NOT NULL THEN
    RAISE EXCEPTION 'Already undone at %', req.undone_at;
  END IF;

  SELECT undo_seconds INTO window_seconds FROM public.admin_role_undo_windows WHERE role = req.role;
  window_seconds := COALESCE(window_seconds, 900);
  age_seconds := EXTRACT(EPOCH FROM (now() - req.reviewed_at))::int;
  IF age_seconds > window_seconds THEN
    RAISE EXCEPTION 'Undo window expired (%s > %s seconds for role %)', age_seconds, window_seconds, req.role;
  END IF;

  -- If approve was applied, verify current DB value still matches (no later change) then revert
  IF req.status = 'approved' THEN
    SELECT allowed INTO cur_allowed FROM public.admin_role_permissions
      WHERE role = req.role AND permission = req.permission;
    IF cur_allowed IS DISTINCT FROM req.allowed THEN
      RAISE EXCEPTION 'Cannot undo — permission was modified after your action';
    END IF;
    INSERT INTO public.admin_role_permissions(role, permission, allowed, updated_at, updated_by)
    VALUES (req.role, req.permission, COALESCE(req.snapshot_before_allowed, false), now(), auth.uid())
    ON CONFLICT (role, permission) DO UPDATE
      SET allowed = EXCLUDED.allowed, updated_at = now(), updated_by = auth.uid();
  END IF;

  UPDATE public.permission_change_requests
    SET undone_at = now(), undone_by = auth.uid(), undo_note = _note,
        status = 'pending', reviewed_by = NULL, reviewed_at = NULL
    WHERE id = _request_id;

  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'permission_change_undone', 'permission', NULL,
          jsonb_build_object('role', req.role, 'permission', req.permission,
                             'reverted_allowed', req.allowed,
                             'restored_to', COALESCE(req.snapshot_before_allowed, false),
                             'previous_status', req.status,
                             'request_id', _request_id, 'note', _note,
                             'window_seconds', window_seconds, 'age_seconds', age_seconds));
END; $$;

GRANT EXECUTE ON FUNCTION public.undo_permission_change(uuid, text) TO authenticated;
