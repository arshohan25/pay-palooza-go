
-- 1. Update trigger to strip all synthetic email domains
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_phone TEXT;
BEGIN
  v_phone := COALESCE(NEW.phone, '');
  IF v_phone = '' AND NEW.email IS NOT NULL THEN
    v_phone := regexp_replace(NEW.email, '@(easypay\.app|easypay\.local|example\.com|team\.easypay\.app)$', '');
  END IF;

  INSERT INTO public.profiles (user_id, phone)
  VALUES (NEW.id, v_phone);
  RETURN NEW;
END;
$$;

-- 2. Fix existing corrupted phone data
UPDATE profiles
SET phone = regexp_replace(phone, '@(easypay\.app|easypay\.local|example\.com)$', '')
WHERE phone LIKE '%@easypay.app' OR phone LIKE '%@easypay.local' OR phone LIKE '%@example.com';
