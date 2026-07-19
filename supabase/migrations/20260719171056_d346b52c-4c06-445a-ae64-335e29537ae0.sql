
-- 1. Backfill: keep only the earliest role per user, drop the rest.
WITH ranked AS (
  SELECT id, user_id,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at NULLS LAST, id) AS rn
  FROM public.user_roles
)
DELETE FROM public.user_roles ur
USING ranked r
WHERE ur.id = r.id AND r.rn > 1;

-- 2. Ensure the hard uniqueness constraint exists (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.user_roles'::regclass
      AND conname = 'user_roles_user_id_unique'
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

-- 3. Safeguard trigger with a clear, human-readable error message.
CREATE OR REPLACE FUNCTION public.enforce_single_role_per_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_role text;
  target_phone text;
BEGIN
  SELECT role::text INTO existing_role
  FROM public.user_roles
  WHERE user_id = NEW.user_id
    AND (TG_OP = 'INSERT' OR id <> NEW.id)
  LIMIT 1;

  IF existing_role IS NOT NULL THEN
    SELECT phone INTO target_phone FROM public.profiles WHERE user_id = NEW.user_id LIMIT 1;
    RAISE EXCEPTION
      'Phone % already has role "%". Each phone number can hold only one role. Remove the existing role before assigning a new one.',
      COALESCE(target_phone, NEW.user_id::text), existing_role
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_single_role_per_user ON public.user_roles;
CREATE TRIGGER trg_enforce_single_role_per_user
  BEFORE INSERT OR UPDATE OF user_id ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_role_per_user();
