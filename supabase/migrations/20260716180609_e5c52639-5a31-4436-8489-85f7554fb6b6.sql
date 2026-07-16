
DROP FUNCTION IF EXISTS public.get_customer_daily_cashin_usage(text);

CREATE OR REPLACE FUNCTION public.get_customer_daily_cashin_usage(p_phone text)
RETURNS TABLE(used numeric, customer_user_id uuid, is_user_wallet boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_is_user boolean := false;
  v_has_other boolean := false;
BEGIN
  SELECT user_id INTO v_user_id FROM public.profiles WHERE phone = p_phone LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT 0::numeric, NULL::uuid, false;
    RETURN;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_user_id
      AND role::text IN ('agent','distributor','super_distributor','merchant','admin','moderator')
  ) INTO v_has_other;

  v_is_user := NOT v_has_other;

  RETURN QUERY
  SELECT COALESCE(SUM(amount), 0)::numeric, v_user_id, v_is_user
  FROM public.transactions
  WHERE user_id = v_user_id
    AND type = 'cashin'
    AND status = 'completed'
    AND created_at >= date_trunc('day', now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_customer_daily_cashin_usage(text) TO authenticated;
