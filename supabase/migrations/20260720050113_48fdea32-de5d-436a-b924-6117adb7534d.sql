
CREATE OR REPLACE FUNCTION public.merchant_update_business_name(p_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF length(v_name) < 2 OR length(v_name) > 120 THEN
    RAISE EXCEPTION 'invalid_business_name';
  END IF;

  UPDATE public.merchants
     SET business_name = v_name,
         updated_at   = now()
   WHERE user_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'merchant_not_found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.merchant_update_business_name(text) FROM public;
GRANT EXECUTE ON FUNCTION public.merchant_update_business_name(text) TO authenticated;
