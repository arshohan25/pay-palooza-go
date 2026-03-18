CREATE POLICY "Authenticated users can read merchants"
ON public.merchants
FOR SELECT
TO authenticated
USING (true);