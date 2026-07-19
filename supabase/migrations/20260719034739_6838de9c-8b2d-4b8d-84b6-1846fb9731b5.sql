
-- Enforce: one phone number = one EasyPay account, forever.
-- 1) Unique constraint on active profiles.phone
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique_idx
  ON public.profiles (phone);

-- 2) Block reuse of a phone that previously belonged to a deleted account
CREATE OR REPLACE FUNCTION public.prevent_phone_reuse()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.phone IS NULL THEN
    RETURN NEW;
  END IF;

  -- Another active profile already owns this phone
  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.phone = NEW.phone
      AND p.user_id <> NEW.user_id
  ) THEN
    RAISE EXCEPTION 'This phone number is already registered to another EasyPay account.'
      USING ERRCODE = 'unique_violation';
  END IF;

  -- Phone was previously used by a deleted/removed account
  IF EXISTS (
    SELECT 1 FROM public.deleted_users d
    WHERE d.phone = NEW.phone
  ) THEN
    RAISE EXCEPTION 'This phone number was previously used on EasyPay and cannot be reused to create a new account.'
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_phone_reuse ON public.profiles;
CREATE TRIGGER trg_prevent_phone_reuse
  BEFORE INSERT OR UPDATE OF phone ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_phone_reuse();
