CREATE POLICY "Admins can view all payment sessions"
  ON public.payment_sessions FOR SELECT
  USING (has_role(auth.uid(), 'admin'));