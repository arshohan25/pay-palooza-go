-- 1) merchant_login_attempts: add explicit admin SELECT + service_role manage
CREATE POLICY "Admins view merchant login attempts"
  ON public.merchant_login_attempts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages merchant login attempts"
  ON public.merchant_login_attempts
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 2) merchant_pin_reset_requests: allow anonymous/authenticated inserts (public request) + service role
CREATE POLICY "Anyone can create pin reset requests"
  ON public.merchant_pin_reset_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (phone IS NOT NULL AND length(phone) BETWEEN 6 AND 20);

CREATE POLICY "Service role manages pin reset requests"
  ON public.merchant_pin_reset_requests
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 3) Remove sensitive tables from realtime publication (admin-only tables don't need broadcast)
ALTER PUBLICATION supabase_realtime DROP TABLE public.kyc_verifications;
ALTER PUBLICATION supabase_realtime DROP TABLE public.fraud_alerts;
ALTER PUBLICATION supabase_realtime DROP TABLE public.easypay_uid_access_alerts;
ALTER PUBLICATION supabase_realtime DROP TABLE public.mcp_tool_call_logs;
ALTER PUBLICATION supabase_realtime DROP TABLE public.admin_role_permission_presets;
ALTER PUBLICATION supabase_realtime DROP TABLE public.permission_change_requests;

-- 4) wallet_route_codes: restrict public read to authenticated only
DROP POLICY IF EXISTS "Route codes are readable by everyone" ON public.wallet_route_codes;
REVOKE SELECT ON public.wallet_route_codes FROM anon;
CREATE POLICY "Route codes readable by authenticated"
  ON public.wallet_route_codes
  FOR SELECT TO authenticated
  USING (true);