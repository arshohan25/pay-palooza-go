-- 1. Restrict commission_tiers read access to admins only (remove public-authenticated read)
DROP POLICY IF EXISTS "Authenticated users can read active tiers" ON public.commission_tiers;

-- 2. Add explicit restrictive policy ensuring ONLY admins can SELECT recharge_api_configs
-- Existing "Admins can manage recharge api configs" (FOR ALL) already permits admins.
-- Add a RESTRICTIVE policy as defense-in-depth that denies SELECT to non-admins.
CREATE POLICY "Recharge API configs admin-only select restrictive"
ON public.recharge_api_configs
AS RESTRICTIVE
FOR SELECT
TO authenticated, anon
USING (has_role(auth.uid(), 'admin'::app_role));