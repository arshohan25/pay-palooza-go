CREATE POLICY "Anyone can view active merchants"
  ON public.merchants
  FOR SELECT
  TO public
  USING (status = 'active');