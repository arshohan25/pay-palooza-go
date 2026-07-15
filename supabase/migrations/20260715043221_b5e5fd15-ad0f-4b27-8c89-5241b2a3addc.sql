
-- Add expiry to permission change requests
ALTER TABLE public.permission_change_requests
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days');

-- Extend status enum with 'expired'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                 WHERE t.typname = 'perm_change_status' AND e.enumlabel = 'expired') THEN
    ALTER TYPE public.perm_change_status ADD VALUE 'expired';
  END IF;
END $$;

-- Helper: mark stale requests as expired (called on read)
CREATE OR REPLACE FUNCTION public.expire_stale_permission_requests()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n INTEGER;
BEGIN
  WITH upd AS (
    UPDATE public.permission_change_requests
      SET status = 'expired', reviewed_at = now(), review_note = COALESCE(review_note,'auto-expired')
      WHERE status = 'pending' AND expires_at < now()
      RETURNING id
  ) SELECT count(*) INTO n FROM upd;
  RETURN n;
END;
$$;
GRANT EXECUTE ON FUNCTION public.expire_stale_permission_requests() TO authenticated;

-- Notify all admins/manage_roles holders when a new pending request is created.
CREATE OR REPLACE FUNCTION public.notify_admins_permission_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE u RECORD;
BEGIN
  IF NEW.status <> 'pending' THEN RETURN NEW; END IF;
  FOR u IN
    SELECT DISTINCT user_id FROM public.user_roles WHERE role = 'admin'
      AND user_id <> NEW.requested_by
  LOOP
    INSERT INTO public.notifications(user_id, title, body, category, metadata, read)
    VALUES (
      u.user_id,
      'Permission change awaiting your approval',
      format('%s %s for %s — review required.',
             CASE WHEN NEW.allowed THEN 'Grant' ELSE 'Revoke' END,
             NEW.permission, replace(NEW.role,'_',' ')),
      'system',
      jsonb_build_object('request_id', NEW.id, 'role', NEW.role,
                         'permission', NEW.permission, 'allowed', NEW.allowed,
                         'link', '/admin#perm_approvals'),
      false
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS perm_request_notify ON public.permission_change_requests;
CREATE TRIGGER perm_request_notify
  AFTER INSERT ON public.permission_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_permission_request();

-- Log preset create/update/delete
CREATE OR REPLACE FUNCTION public.log_preset_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    CASE TG_OP WHEN 'INSERT' THEN 'preset_created'
               WHEN 'UPDATE' THEN 'preset_updated'
               WHEN 'DELETE' THEN 'preset_deleted' END,
    'preset', NULL,
    jsonb_build_object(
      'preset_id', COALESCE(NEW.id, OLD.id),
      'name', COALESCE(NEW.name, OLD.name),
      'permissions', COALESCE(NEW.permissions, OLD.permissions)
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS preset_change_log ON public.admin_role_permission_presets;
CREATE TRIGGER preset_change_log
  AFTER INSERT OR UPDATE OR DELETE ON public.admin_role_permission_presets
  FOR EACH ROW EXECUTE FUNCTION public.log_preset_change();
