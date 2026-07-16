
CREATE OR REPLACE FUNCTION public.get_customer_daily_cashin_usage(p_phone text)
RETURNS TABLE(used numeric, customer_user_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id FROM public.profiles WHERE phone = p_phone LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT 0::numeric, NULL::uuid;
    RETURN;
  END IF;
  RETURN QUERY
  SELECT COALESCE(SUM(amount), 0)::numeric, v_user_id
  FROM public.transactions
  WHERE user_id = v_user_id
    AND type = 'cashin'
    AND status = 'completed'
    AND created_at >= date_trunc('day', now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_customer_daily_cashin_usage(text) TO authenticated;
