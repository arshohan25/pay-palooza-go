
CREATE OR REPLACE FUNCTION public.get_public_session_info(p_session_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_session RECORD;
  v_merchant_name text;
  v_merchant_category text;
BEGIN
  SELECT id, amount, currency, reference, description, status, success_url, expires_at, merchant_id, metadata
  INTO v_session
  FROM merchant_payment_sessions
  WHERE id = p_session_id;

  IF v_session.id IS NULL THEN RETURN NULL; END IF;

  SELECT business_name, category::text
  INTO v_merchant_name, v_merchant_category
  FROM merchants WHERE id = v_session.merchant_id;

  RETURN json_build_object(
    'id', v_session.id,
    'amount', v_session.amount,
    'currency', v_session.currency,
    'reference', v_session.reference,
    'description', v_session.description,
    'status', v_session.status,
    'success_url', v_session.success_url,
    'expires_at', v_session.expires_at,
    'merchant_id', v_session.merchant_id,
    'metadata', v_session.metadata,
    'merchant_name', v_merchant_name,
    'merchant_category', v_merchant_category
  );
END;
$$;
