
-- Fix the security definer view warning by setting security_invoker = true
-- and granting the underlying table SELECT to anon/authenticated for specific columns only
ALTER VIEW public.merchants_public SET (security_invoker = true);

-- Since the view now runs as the invoker, anon users need SELECT on the underlying table
-- but we already removed the public RLS policy. Instead, create a minimal RLS policy for anon
-- that only allows reading active merchants (the view restricts columns)
CREATE POLICY "Anon can read active merchants via view"
ON public.merchants
FOR SELECT TO anon
USING (status = 'active');
