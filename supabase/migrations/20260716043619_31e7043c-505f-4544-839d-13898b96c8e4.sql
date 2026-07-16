
CREATE OR REPLACE FUNCTION public.add_merchant_category_if_missing(_label text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_label text := btrim(_label);
  v_name text;
  v_existing text;
  v_max int;
BEGIN
  IF v_label IS NULL OR length(v_label) = 0 THEN
    RAISE EXCEPTION 'Category label required';
  END IF;
  IF length(v_label) > 80 THEN
    v_label := left(v_label, 80);
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_name := lower(regexp_replace(v_label, '[^a-zA-Z0-9]+', '_', 'g'));
  v_name := btrim(v_name, '_');
  IF length(v_name) = 0 THEN
    RAISE EXCEPTION 'Invalid category label';
  END IF;

  SELECT name INTO v_existing FROM public.merchant_categories
    WHERE lower(name) = v_name OR lower(label) = lower(v_label)
    LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  SELECT COALESCE(MAX(sort_order), 0) INTO v_max FROM public.merchant_categories;

  INSERT INTO public.merchant_categories (name, label, sort_order, is_active)
  VALUES (v_name, v_label, v_max + 10, true);

  RETURN v_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_merchant_category_if_missing(text) TO authenticated;
