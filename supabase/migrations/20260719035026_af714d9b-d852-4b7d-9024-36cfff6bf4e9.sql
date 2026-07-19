
-- Audit table for phone unblock actions
CREATE TABLE public.phone_unblock_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  admin_id uuid NOT NULL REFERENCES auth.users(id),
  reason text NOT NULL,
  previous_deleted_user_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.phone_unblock_audit TO authenticated;
GRANT ALL ON public.phone_unblock_audit TO service_role;

ALTER TABLE public.phone_unblock_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view phone unblock audit"
  ON public.phone_unblock_audit FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert phone unblock audit"
  ON public.phone_unblock_audit FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND admin_id = auth.uid());

CREATE INDEX idx_phone_unblock_audit_phone ON public.phone_unblock_audit(phone);
CREATE INDEX idx_phone_unblock_audit_created_at ON public.phone_unblock_audit(created_at DESC);

-- List currently blocked phones (from deleted accounts) — admin only
CREATE OR REPLACE FUNCTION public.admin_list_blocked_phones()
RETURNS TABLE (
  phone text,
  deleted_user_id uuid,
  name text,
  deleted_at timestamptz,
  deletion_reason text,
  last_unblock_attempt timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    d.phone,
    d.user_id AS deleted_user_id,
    d.name,
    d.deleted_at,
    d.deletion_reason,
    (SELECT MAX(a.created_at) FROM public.phone_unblock_audit a WHERE a.phone = d.phone) AS last_unblock_attempt
  FROM public.deleted_users d
  WHERE d.phone IS NOT NULL
  ORDER BY d.deleted_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_blocked_phones() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_blocked_phones() TO authenticated;

-- Unblock a phone — admin only, fully audited
CREATE OR REPLACE FUNCTION public.admin_unblock_phone(
  _phone text,
  _reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_deleted_user_id uuid;
  v_affected int;
BEGIN
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT public.has_role(v_admin, 'admin') THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF _phone IS NULL OR length(trim(_phone)) = 0 THEN
    RAISE EXCEPTION 'Phone is required';
  END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 5 THEN
    RAISE EXCEPTION 'A reason (min 5 chars) is required for audit';
  END IF;

  -- Block if phone is currently in use on an active profile
  IF EXISTS (SELECT 1 FROM public.profiles WHERE phone = _phone) THEN
    RAISE EXCEPTION 'Phone is currently in use on an active account and cannot be unblocked';
  END IF;

  SELECT user_id INTO v_deleted_user_id
  FROM public.deleted_users
  WHERE phone = _phone
  ORDER BY deleted_at DESC
  LIMIT 1;

  -- Null out the phone on all matching deleted_users rows so the reuse trigger allows a fresh signup
  UPDATE public.deleted_users
     SET phone = NULL
   WHERE phone = _phone;
  GET DIAGNOSTICS v_affected = ROW_COUNT;

  INSERT INTO public.phone_unblock_audit (phone, admin_id, reason, previous_deleted_user_id, metadata)
  VALUES (_phone, v_admin, _reason, v_deleted_user_id, jsonb_build_object('rows_cleared', v_affected));

  RETURN jsonb_build_object(
    'success', true,
    'phone', _phone,
    'rows_cleared', v_affected
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_unblock_phone(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_unblock_phone(text, text) TO authenticated;
