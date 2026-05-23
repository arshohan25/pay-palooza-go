
CREATE OR REPLACE FUNCTION public.checkout_atomic_transfer(
  p_payer_user_id uuid,
  p_recipient_user_id uuid,
  p_amount numeric,
  p_payer_recipient_phone text,
  p_payer_recipient_name text,
  p_recipient_payer_phone text,
  p_recipient_payer_name text,
  p_description text DEFAULT NULL,
  p_reference text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payer_balance numeric;
  v_recipient_balance numeric;
  v_payer_new numeric;
  v_recipient_new numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;
  IF p_payer_user_id = p_recipient_user_id THEN
    RAISE EXCEPTION 'Cannot pay yourself';
  END IF;

  -- Lock both profile rows in deterministic order to avoid deadlocks
  IF p_payer_user_id < p_recipient_user_id THEN
    SELECT balance INTO v_payer_balance FROM public.profiles
      WHERE user_id = p_payer_user_id AND status = 'active' FOR UPDATE;
    SELECT balance INTO v_recipient_balance FROM public.profiles
      WHERE user_id = p_recipient_user_id AND status = 'active' FOR UPDATE;
  ELSE
    SELECT balance INTO v_recipient_balance FROM public.profiles
      WHERE user_id = p_recipient_user_id AND status = 'active' FOR UPDATE;
    SELECT balance INTO v_payer_balance FROM public.profiles
      WHERE user_id = p_payer_user_id AND status = 'active' FOR UPDATE;
  END IF;

  IF v_payer_balance IS NULL THEN
    RAISE EXCEPTION 'Payer account not found or inactive';
  END IF;
  IF v_recipient_balance IS NULL THEN
    RAISE EXCEPTION 'Recipient account not found or inactive';
  END IF;
  IF v_payer_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  v_payer_new := v_payer_balance - p_amount;
  v_recipient_new := v_recipient_balance + p_amount;

  UPDATE public.profiles SET balance = v_payer_new WHERE user_id = p_payer_user_id;
  UPDATE public.profiles SET balance = v_recipient_new WHERE user_id = p_recipient_user_id;

  INSERT INTO public.transactions
    (user_id, type, amount, fee, balance_after, recipient_phone, recipient_name, description, reference, status)
  VALUES
    (p_payer_user_id, 'payment', p_amount, 0, v_payer_new,
     p_payer_recipient_phone, p_payer_recipient_name,
     COALESCE(p_description, 'Payment to ' || COALESCE(p_payer_recipient_name, p_payer_recipient_phone)),
     p_reference, 'completed');

  INSERT INTO public.transactions
    (user_id, type, amount, fee, balance_after, recipient_phone, recipient_name, description, reference, status)
  VALUES
    (p_recipient_user_id, 'payment', p_amount, 0, v_recipient_new,
     p_recipient_payer_phone, p_recipient_payer_name,
     COALESCE(p_description, 'Payment from ' || COALESCE(p_recipient_payer_name, p_recipient_payer_phone)),
     p_reference, 'completed');

  RETURN json_build_object(
    'success', true,
    'payer_balance', v_payer_new,
    'recipient_balance', v_recipient_new
  );
END;
$$;

REVOKE ALL ON FUNCTION public.checkout_atomic_transfer(uuid,uuid,numeric,text,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.checkout_atomic_transfer(uuid,uuid,numeric,text,text,text,text,text,text) TO service_role;
