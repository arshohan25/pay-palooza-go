
-- Fix 1: Restrict profile creation to zero balance and safe initial status
DROP POLICY IF EXISTS "Users can create own profile" ON public.profiles;
CREATE POLICY "Users can create own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND auth.uid() = user_id
  AND balance = 0
  AND (status IS NULL OR status = 'active')
);

-- Fix 2: Restrict sensitive-access-log inserts to security roles only
DROP POLICY IF EXISTS "Authorized staff can create sensitive access logs" ON public.admin_sensitive_access_logs;
CREATE POLICY "Security staff can create sensitive access logs"
ON public.admin_sensitive_access_logs
FOR INSERT
TO authenticated
WITH CHECK (
  actor_id = auth.uid()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'compliance'::app_role)
    OR has_role(auth.uid(), 'risk'::app_role)
    OR has_role(auth.uid(), 'audit'::app_role)
  )
);
