CREATE OR REPLACE FUNCTION public.log_kyc_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_agent_id UUID;
  v_role TEXT;
  v_actor UUID;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT referrer_id INTO v_agent_id
  FROM public.referrals
  WHERE referee_id = NEW.user_id
  LIMIT 1;

  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    v_role := 'system';
  ELSIF public.has_role(v_actor, 'admin') THEN
    v_role := 'admin';
  ELSIF v_actor = v_agent_id THEN
    v_role := 'agent';
  ELSE
    v_role := 'user';
  END IF;

  INSERT INTO public.kyc_status_audit(
    kyc_verification_id, user_id, agent_id, changed_by, changed_by_role,
    previous_status, new_status, reviewer_notes
  ) VALUES (
    NEW.id,
    NEW.user_id,
    v_agent_id,
    v_actor,
    v_role,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
    NEW.status,
    NEW.reviewer_notes
  );

  RETURN NEW;
END;
$function$;

-- The trigger above already records history, so the admin RPC no longer inserts its own row.
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

  RETURN jsonb_build_object(
    'kyc_verification_id', v_id,
    'previous_status', v_prev,
    'new_status', _status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_kyc_status(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_kyc_status(uuid, text, text) TO authenticated;