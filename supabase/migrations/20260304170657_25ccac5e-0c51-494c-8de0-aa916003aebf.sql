
-- 1. Fix the handle_new_user() trigger to strip @easypay.local suffix
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_phone TEXT;
BEGIN
  v_phone := COALESCE(NEW.phone, '');
  -- If phone is empty, try to extract from email (phone-as-email auth pattern)
  IF v_phone = '' AND NEW.email IS NOT NULL THEN
    -- Strip @easypay.local suffix if present
    IF NEW.email LIKE '%@easypay.local' THEN
      v_phone := REPLACE(NEW.email, '@easypay.local', '');
    ELSE
      v_phone := NEW.email;
    END IF;
  END IF;

  INSERT INTO public.profiles (user_id, phone)
  VALUES (NEW.id, v_phone);
  RETURN NEW;
END;
$function$;

-- 2. Repair existing corrupted phone values
UPDATE public.profiles
SET phone = REPLACE(phone, '@easypay.local', '')
WHERE phone LIKE '%@easypay.local';
