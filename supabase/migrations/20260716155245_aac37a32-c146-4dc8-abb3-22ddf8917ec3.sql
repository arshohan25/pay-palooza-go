
DROP POLICY IF EXISTS "Service role can log redirect attempts" ON public.role_redirect_logs;
CREATE POLICY "Authenticated users can log their own redirects" ON public.role_redirect_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
