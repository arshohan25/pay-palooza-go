ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS business_name_bn text;

CREATE OR REPLACE FUNCTION public.merchant_update_business_name(p_name text, p_name_bn text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_name_bn text := NULLIF(btrim(coalesce(p_name_bn, '')), '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF length(v_name) < 2 OR length(v_name) > 120 THEN
    RAISE EXCEPTION 'invalid_business_name';
  END IF;
  IF v_name_bn IS NOT NULL AND length(v_name_bn) > 120 THEN
    RAISE EXCEPTION 'invalid_business_name_bn';
  END IF;

  UPDATE public.merchants
     SET business_name = v_name,
         business_name_bn = v_name_bn,
         updated_at   = now()
   WHERE user_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'merchant_not_found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.merchant_update_business_name(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.merchant_update_business_name(text, text) TO authenticated;