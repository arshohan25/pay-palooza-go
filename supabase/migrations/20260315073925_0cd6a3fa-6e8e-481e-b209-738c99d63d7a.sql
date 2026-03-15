CREATE OR REPLACE FUNCTION public.is_phone_registered(p_phone text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_norm text;
BEGIN
  v_norm := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
  IF left(v_norm, 2) = '88' AND length(v_norm) > 11 THEN
    v_norm := substring(v_norm FROM 3);
  END IF;
  IF v_norm !~ '^01[3-9][0-9]{8}$' THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE phone = v_norm LIMIT 1
  );
END;
$$;