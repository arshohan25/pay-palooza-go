
-- 1) Restrict policies to authenticated role (defense-in-depth)

-- admin_canned_replies
DROP POLICY IF EXISTS "Admins can delete own canned replies" ON public.admin_canned_replies;
DROP POLICY IF EXISTS "Admins can insert own canned replies" ON public.admin_canned_replies;
DROP POLICY IF EXISTS "Admins can update own canned replies" ON public.admin_canned_replies;
DROP POLICY IF EXISTS "Admins can view own canned replies" ON public.admin_canned_replies;

CREATE POLICY "Admins can view own canned replies" ON public.admin_canned_replies
  FOR SELECT TO authenticated USING (auth.uid() = user_id AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert own canned replies" ON public.admin_canned_replies
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update own canned replies" ON public.admin_canned_replies
  FOR UPDATE TO authenticated USING (auth.uid() = user_id AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete own canned replies" ON public.admin_canned_replies
  FOR DELETE TO authenticated USING (auth.uid() = user_id AND has_role(auth.uid(), 'admin'::app_role));

-- merchant_permission_presets
DROP POLICY IF EXISTS "Owners can create presets" ON public.merchant_permission_presets;
DROP POLICY IF EXISTS "Owners can delete their presets" ON public.merchant_permission_presets;
DROP POLICY IF EXISTS "Owners can update their presets" ON public.merchant_permission_presets;
DROP POLICY IF EXISTS "Owners can view their presets" ON public.merchant_permission_presets;

CREATE POLICY "Owners can view their presets" ON public.merchant_permission_presets
  FOR SELECT TO authenticated
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));
CREATE POLICY "Owners can create presets" ON public.merchant_permission_presets
  FOR INSERT TO authenticated
  WITH CHECK (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Owners can update their presets" ON public.merchant_permission_presets
  FOR UPDATE TO authenticated
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));
CREATE POLICY "Owners can delete their presets" ON public.merchant_permission_presets
  FOR DELETE TO authenticated
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

-- treasury_ledger
DROP POLICY IF EXISTS "Admins can view treasury ledger" ON public.treasury_ledger;
CREATE POLICY "Admins can view treasury ledger" ON public.treasury_ledger
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- vendor_earnings_ledger
DROP POLICY IF EXISTS "Admins view all earnings" ON public.vendor_earnings_ledger;
DROP POLICY IF EXISTS "Vendors view own earnings" ON public.vendor_earnings_ledger;
CREATE POLICY "Admins view all earnings" ON public.vendor_earnings_ledger
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Vendors view own earnings" ON public.vendor_earnings_ledger
  FOR SELECT TO authenticated
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

-- vendor_wallets
DROP POLICY IF EXISTS "Admins view all wallets" ON public.vendor_wallets;
DROP POLICY IF EXISTS "Vendors view own wallet" ON public.vendor_wallets;
CREATE POLICY "Admins view all wallets" ON public.vendor_wallets
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Vendors view own wallet" ON public.vendor_wallets
  FOR SELECT TO authenticated
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

-- 2) Remove sensitive config/credential tables from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.recharge_api_configs;
ALTER PUBLICATION supabase_realtime DROP TABLE public.biller_api_configs;
ALTER PUBLICATION supabase_realtime DROP TABLE public.payment_gateways;
