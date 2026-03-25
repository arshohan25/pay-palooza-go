
-- Step 1: Create a safe public view exposing only non-sensitive merchant columns
CREATE OR REPLACE VIEW public.merchants_public AS
SELECT id, user_id, business_name, category, qr_code_data, status, created_at
FROM public.merchants
WHERE status = 'active';

-- Grant access to the view for anon and authenticated roles
GRANT SELECT ON public.merchants_public TO anon, authenticated;

-- Step 2: Drop the overly permissive public policy
DROP POLICY IF EXISTS "Public can read active merchants for shop" ON public.merchants;

-- Re-create as authenticated-only
CREATE POLICY "Authenticated can read active merchants"
ON public.merchants
FOR SELECT TO authenticated
USING (status = 'active');

-- Step 3: Harden has_role() to always check auth.uid() instead of the passed user_id
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = _role
  )
$$;
