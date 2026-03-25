
-- Remove the dangerous anon policy that exposes all columns
DROP POLICY IF EXISTS "Anon can read active merchants via view" ON public.merchants;

-- Drop the view approach entirely
DROP VIEW IF EXISTS public.merchants_public;

-- Instead, create a SECURITY DEFINER function that returns only safe columns
CREATE OR REPLACE FUNCTION public.get_public_merchants()
RETURNS TABLE(id uuid, user_id uuid, business_name text, category text, qr_code_data text, status text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.user_id, m.business_name, m.category, m.qr_code_data, m.status::text, m.created_at
  FROM public.merchants m
  WHERE m.status = 'active';
$$;
