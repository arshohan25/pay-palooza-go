CREATE OR REPLACE FUNCTION public.admin_revoke_trusted_device(_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row public.trusted_devices;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can revoke device trust';
  END IF;

  UPDATE public.trusted_devices
     SET revoked_at = now(), token_hash = NULL, token_expires_at = NULL
   WHERE id = _id AND revoked_at IS NULL
   RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'revoke_trusted_device', 'trusted_device', _id::text,
          jsonb_build_object('phone', v_row.phone, 'portal', v_row.portal, 'device_fp', v_row.device_fp));

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_revoke_trusted_device(uuid) TO authenticated;