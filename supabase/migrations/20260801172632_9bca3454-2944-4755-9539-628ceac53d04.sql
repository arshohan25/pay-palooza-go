CREATE OR REPLACE FUNCTION public.admin_set_kyc_status(
  _user_id uuid,
  _status text,
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_prev text;
  v_id uuid;
BEGIN
  IF NOT public.has_role(v_actor, 'admin') THEN
    RAISE EXCEPTION 'Only admins can change KYC status';
  END IF;

  IF _status NOT IN ('not_submitted', 'pending', 'verified', 'rejected') THEN
    RAISE EXCEPTION 'Invalid KYC status: %', _status;
  END IF;

  SELECT id, status INTO v_id, v_prev
  FROM public.kyc_verifications
  WHERE user_id = _user_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.kyc_verifications (user_id, status, reviewer_id, reviewer_notes, reviewed_at)
    VALUES (_user_id, _status, v_actor, _notes, now())
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.kyc_verifications
    SET status = _status,
        reviewer_id = v_actor,
        reviewer_notes = COALESCE(_notes, reviewer_notes),
        reviewed_at = now(),
        updated_at = now()
    WHERE id = v_id;
  END IF;

  INSERT INTO public.kyc_status_audit (
    user_id, kyc_verification_id, previous_status, new_status,
    changed_by, changed_by_role, reviewer_notes
  ) VALUES (
    _user_id, v_id, v_prev, _status, v_actor, 'admin', _notes
  );

  RETURN jsonb_build_object(
    'kyc_verification_id', v_id,
    'previous_status', v_prev,
    'new_status', _status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_kyc_status(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_kyc_status(uuid, text, text) TO authenticated;