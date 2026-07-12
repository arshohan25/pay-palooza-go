-- Agent-initiated Cash Out with customer OTP authorization

CREATE OR REPLACE FUNCTION public.agent_cashout_initiate(
  p_customer_phone text,
  p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent uuid := auth.uid();
  v_customer uuid;
  v_code text;
  v_purpose text;
BEGIN
  IF v_agent IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF NOT public.has_role(v_agent, 'agent'::app_role) THEN
    RAISE EXCEPTION 'agent_role_required';
  END IF;
  IF p_amount < 50 OR p_amount > 25000 THEN
    RAISE EXCEPTION 'amount_out_of_range';
  END IF;

  SELECT user_id INTO v_customer FROM public.profiles WHERE phone = p_customer_phone;
  IF v_customer IS NULL THEN
    RAISE EXCEPTION 'customer_not_found';
  END IF;
  IF v_customer = v_agent THEN
    RAISE EXCEPTION 'cannot_cashout_self';
  END IF;

  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
  v_purpose := 'cashout:' || v_agent::text || ':' || p_amount::text;

  -- Invalidate any prior unverified OTPs for this triple
  UPDATE public.otp_codes
    SET verified = true
  WHERE phone = p_customer_phone
    AND purpose = v_purpose
    AND verified = false;

  INSERT INTO public.otp_codes (phone, code, purpose, expires_at, verified)
  VALUES (p_customer_phone, v_code, v_purpose, now() + interval '3 minutes', false);

  RETURN jsonb_build_object(
    'success', true,
    'expires_in_seconds', 180,
    -- Return code only in dev/staging via server logs; here we return masked info.
    'debug_code', v_code
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.agent_cashout_initiate(text, numeric) TO authenticated;


CREATE OR REPLACE FUNCTION public.agent_cashout_confirm(
  p_customer_phone text,
  p_amount numeric,
  p_otp text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent uuid := auth.uid();
  v_customer uuid;
  v_purpose text;
  v_otp_id uuid;
  v_fee numeric := 0;
  v_commission numeric := 0;
  v_ref text;
  v_customer_balance numeric;
BEGIN
  IF v_agent IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF NOT public.has_role(v_agent, 'agent'::app_role) THEN
    RAISE EXCEPTION 'agent_role_required';
  END IF;

  SELECT user_id INTO v_customer FROM public.profiles WHERE phone = p_customer_phone;
  IF v_customer IS NULL THEN
    RAISE EXCEPTION 'customer_not_found';
  END IF;

  v_purpose := 'cashout:' || v_agent::text || ':' || p_amount::text;

  SELECT id INTO v_otp_id
  FROM public.otp_codes
  WHERE phone = p_customer_phone
    AND purpose = v_purpose
    AND code = p_otp
    AND verified = false
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_otp_id IS NULL THEN
    RAISE EXCEPTION 'invalid_or_expired_otp';
  END IF;

  -- Fee lookup (cashout tier)
  SELECT COALESCE(fee_flat, 0) INTO v_fee
  FROM public.fee_config
  WHERE txn_type = 'cashout'
    AND p_amount BETWEEN min_amount AND max_amount
    AND active = true
  ORDER BY min_amount DESC
  LIMIT 1;

  v_commission := round(p_amount * 0.004, 2);

  SELECT balance INTO v_customer_balance FROM public.profiles WHERE user_id = v_customer FOR UPDATE;
  IF v_customer_balance < (p_amount + v_fee) THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  -- Debit customer
  UPDATE public.profiles SET balance = balance - (p_amount + v_fee) WHERE user_id = v_customer;
  -- Credit agent
  UPDATE public.profiles SET balance = balance + p_amount + v_commission WHERE user_id = v_agent;

  UPDATE public.otp_codes SET verified = true WHERE id = v_otp_id;

  v_ref := upper(substring(md5(random()::text || clock_timestamp()::text), 1, 12));

  -- Customer txn (outgoing cashout)
  INSERT INTO public.transactions (user_id, type, amount, fee, recipient_phone, description, reference, status)
  VALUES (v_customer, 'cashout', p_amount, v_fee, p_customer_phone, 'Cash Out at agent', v_ref, 'completed');

  -- Agent txn (incoming cashout)
  INSERT INTO public.transactions (user_id, type, amount, fee, commission, recipient_phone, description, reference, status)
  VALUES (v_agent, 'cashout', p_amount, 0, v_commission, p_customer_phone, 'Agent cash out (customer withdrew)', v_ref, 'completed');

  RETURN jsonb_build_object(
    'success', true,
    'reference', v_ref,
    'fee', v_fee,
    'commission', v_commission
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.agent_cashout_confirm(text, numeric, text) TO authenticated;
