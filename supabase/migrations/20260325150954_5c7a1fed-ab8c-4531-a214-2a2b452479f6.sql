-- 1. Fix merchant_payment_sessions: Remove public read, restrict to payer/merchant/admin
DROP POLICY IF EXISTS "Anyone can read payment sessions" ON public.merchant_payment_sessions;

CREATE POLICY "Payers can read own payment sessions"
ON public.merchant_payment_sessions
FOR SELECT
TO public
USING (
  payer_user_id = auth.uid()
  OR merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- 2. Fix merchants: Remove overly broad SELECT policies, add restricted public read
DROP POLICY IF EXISTS "Authenticated users can read merchants" ON public.merchants;
DROP POLICY IF EXISTS "Public can read merchants for shop" ON public.merchants;

CREATE POLICY "Public can read active merchants for shop"
ON public.merchants
FOR SELECT
TO public
USING (status = 'active');

-- 3. Fix donations: restrict reads to own donations + admins
DROP POLICY IF EXISTS "Authenticated read donations" ON public.donations;

CREATE POLICY "Users read own donations"
ON public.donations
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- 4. Remove temp_password column from team_members
ALTER TABLE public.team_members DROP COLUMN IF EXISTS temp_password;