DROP FUNCTION IF EXISTS public.admin_list_blocked_phones();

CREATE OR REPLACE FUNCTION public.admin_list_blocked_phones()
RETURNS TABLE(
  phone text,
  deleted_user_id uuid,
  original_user_id uuid,
  name text,
  deleted_at timestamptz,
  deletion_reason text,
  deleted_by uuid,
  deleted_by_name text,
  last_unblock_attempt timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    du.phone,
    du.id            AS deleted_user_id,
    du.user_id       AS original_user_id,
    du.name,
    du.deleted_at,
    du.deletion_reason,
    du.deleted_by,
    p.name           AS deleted_by_name,
    (
      SELECT MAX(a.created_at)
      FROM public.phone_unblock_audit a
      WHERE a.phone = du.phone
    ) AS last_unblock_attempt
  FROM public.deleted_users du
  LEFT JOIN public.profiles p ON p.user_id = du.deleted_by
  WHERE du.phone IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'compliance')
    )
  ORDER BY du.deleted_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.admin_bulk_unblock_phones(_phones text[], _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_phone text;
  v_ok int := 0;
  v_failed jsonb := '[]'::jsonb;
BEGIN
  IF NOT (public.has_role(v_admin, 'admin') OR public.has_role(v_admin, 'compliance')) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF _reason IS NULL OR length(trim(_reason)) < 5 THEN
    RAISE EXCEPTION 'reason_too_short';
  END IF;

  IF _phones IS NULL OR array_length(_phones, 1) IS NULL THEN
    RAISE EXCEPTION 'no_phones_provided';
  END IF;

  FOREACH v_phone IN ARRAY _phones LOOP
    BEGIN
      DELETE FROM public.deleted_users WHERE phone = v_phone;
      INSERT INTO public.phone_unblock_audit (phone, admin_id, reason)
      VALUES (v_phone, v_admin, _reason);
      v_ok := v_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed || jsonb_build_object('phone', v_phone, 'error', SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object('unblocked', v_ok, 'failed', v_failed);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_blocked_phones() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_bulk_unblock_phones(text[], text) TO authenticated;