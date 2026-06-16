
-- Unique human-readable EasyPay UID for every user (admin-only visibility)
CREATE SEQUENCE IF NOT EXISTS public.easypay_uid_seq START 100001 MINVALUE 100001;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS easypay_uid text UNIQUE;

-- Backfill existing rows in creation order
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE easypay_uid IS NULL ORDER BY created_at ASC LOOP
    UPDATE public.profiles
      SET easypay_uid = 'EP' || lpad(nextval('public.easypay_uid_seq')::text, 8, '0')
      WHERE id = r.id;
  END LOOP;
END $$;

-- Auto-assign on insert
CREATE OR REPLACE FUNCTION public.set_easypay_uid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.easypay_uid IS NULL OR NEW.easypay_uid = '' THEN
    NEW.easypay_uid := 'EP' || lpad(nextval('public.easypay_uid_seq')::text, 8, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_easypay_uid ON public.profiles;
CREATE TRIGGER trg_set_easypay_uid
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_easypay_uid();

-- Prevent users from changing their own UID (admins via has_role bypass via separate UPDATE policy already)
CREATE OR REPLACE FUNCTION public.protect_easypay_uid()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.easypay_uid IS DISTINCT FROM OLD.easypay_uid
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.easypay_uid := OLD.easypay_uid;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_easypay_uid ON public.profiles;
CREATE TRIGGER trg_protect_easypay_uid
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_easypay_uid();
