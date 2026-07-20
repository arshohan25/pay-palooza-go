
-- Enforce merchant visibility rules at the API layer: users holding the
-- 'merchant' role (without admin) cannot read payout- or dispute-related
-- data even via direct PostgREST calls. Admins retain full access.

-- vendor_wallets
DROP POLICY IF EXISTS "Vendors view own wallet" ON public.vendor_wallets;
CREATE POLICY "Vendors view own wallet"
  ON public.vendor_wallets FOR SELECT
  TO authenticated
  USING (
    merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
    AND (NOT public.has_role(auth.uid(), 'merchant'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
  );

-- vendor_earnings_ledger
DROP POLICY IF EXISTS "Vendors view own earnings" ON public.vendor_earnings_ledger;
CREATE POLICY "Vendors view own earnings"
  ON public.vendor_earnings_ledger FOR SELECT
  TO authenticated
  USING (
    merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
    AND (NOT public.has_role(auth.uid(), 'merchant'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
  );

-- merchant_payouts
DROP POLICY IF EXISTS "Merchants view own payouts" ON public.merchant_payouts;
CREATE POLICY "Merchants view own payouts"
  ON public.merchant_payouts FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_payouts.merchant_id AND m.user_id = auth.uid())
    AND (NOT public.has_role(auth.uid(), 'merchant'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
  );

-- disputes
DROP POLICY IF EXISTS "Users can view own disputes" ON public.disputes;
CREATE POLICY "Users can view own disputes"
  ON public.disputes FOR SELECT
  TO authenticated
  USING (
    auth.uid() = complainant_id
    AND (NOT public.has_role(auth.uid(), 'merchant'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
  );
