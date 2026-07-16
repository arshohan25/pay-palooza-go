-- Allow anonymous reads of merchant categories so the public merchant apply flow can populate its dropdown for signed-out users
DROP POLICY IF EXISTS "Anyone can read categories" ON public.merchant_categories;
CREATE POLICY "Anyone can read categories" ON public.merchant_categories FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON public.merchant_categories TO anon;