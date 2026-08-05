CREATE OR REPLACE FUNCTION public.merchant_session_set_tip(
  p_session_id uuid,
  p_tip numeric
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base numeric;
  v_tip numeric;
  v_total numeric;
  v_tips_on boolean;
BEGIN
  SELECT s.amount - COALESCE(s.tip_amount, 0), COALESCE(m.tips_enabled, false)
    INTO v_base, v_tips_on
    FROM public.merchant_payment_sessions s
    JOIN public.merchants m ON m.id = s.merchant_id
   WHERE s.id = p_session_id
     AND s.status = 'pending'
     AND s.expires_at > now();

  IF v_base IS NULL THEN
    RAISE EXCEPTION 'Session not available for tipping';
  END IF;

  IF NOT v_tips_on THEN
    RAISE EXCEPTION 'Tipping is not enabled for this merchant';
  END IF;

  v_tip := GREATEST(COALESCE(p_tip, 0), 0);
  IF v_tip > GREATEST(v_base, 5000) THEN
    RAISE EXCEPTION 'Tip too large';
  END IF;

  v_total := v_base + v_tip;

  UPDATE public.merchant_payment_sessions
     SET tip_amount = v_tip,
         amount = v_total
   WHERE id = p_session_id;

  RETURN v_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.merchant_session_set_tip(uuid, numeric) TO authenticated;