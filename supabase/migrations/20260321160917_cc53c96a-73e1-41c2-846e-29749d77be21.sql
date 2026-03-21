
-- 1. Add user_id column to merchant_staff
ALTER TABLE public.merchant_staff ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Create trigger to auto-resolve user_id from phone
CREATE OR REPLACE FUNCTION public.resolve_staff_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  SELECT p.user_id INTO NEW.user_id
  FROM public.profiles p
  WHERE p.phone = regexp_replace(COALESCE(NEW.phone, ''), '[^0-9]', '', 'g');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_resolve_staff_user
  BEFORE INSERT OR UPDATE OF phone ON public.merchant_staff
  FOR EACH ROW
  EXECUTE FUNCTION public.resolve_staff_user();

-- 3. Backfill existing rows
UPDATE public.merchant_staff ms
SET user_id = p.user_id
FROM public.profiles p
WHERE p.phone = regexp_replace(COALESCE(ms.phone, ''), '[^0-9]', '', 'g')
  AND ms.user_id IS NULL;

-- 4. RLS policy: linked staff can SELECT their own row
CREATE POLICY "Staff can view own record"
  ON public.merchant_staff
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 5. RPC to check staff access for a user
CREATE OR REPLACE FUNCTION public.get_staff_merchant_access(p_user_id UUID)
RETURNS TABLE(merchant_id UUID, business_name TEXT, staff_role TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT ms.merchant_id, m.business_name, ms.role
  FROM public.merchant_staff ms
  JOIN public.merchants m ON m.id = ms.merchant_id
  WHERE ms.user_id = p_user_id
    AND ms.is_active = true
    AND m.status = 'active'
  LIMIT 1;
$$;
