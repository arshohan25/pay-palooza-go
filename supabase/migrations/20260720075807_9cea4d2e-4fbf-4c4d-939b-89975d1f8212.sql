
-- Tighten access: merchants must have zero access to payout/earnings/wallet/dispute tables

-- Revoke anon (never should have been usable, but be explicit)
REVOKE ALL ON public.vendor_wallets FROM anon;
REVOKE ALL ON public.vendor_earnings_ledger FROM anon;
REVOKE ALL ON public.merchant_payouts FROM anon;
REVOKE ALL ON public.disputes FROM anon;

-- Force RLS so table owners also obey policies
ALTER TABLE public.vendor_wallets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_earnings_ledger FORCE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_payouts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.disputes FORCE ROW LEVEL SECURITY;

-- merchant_payouts: block merchant role from INSERT/UPDATE/DELETE unless admin
DROP POLICY IF EXISTS "Merchants create own payouts" ON public.merchant_payouts;
CREATE POLICY "Merchants create own payouts"
  ON public.merchant_payouts FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM merchants m WHERE m.id = merchant_payouts.merchant_id AND m.user_id = auth.uid())
    AND ((NOT has_role(auth.uid(), 'merchant'::app_role)) OR has_role(auth.uid(), 'admin'::app_role))
  );

-- disputes: block merchant role from INSERT unless admin
DROP POLICY IF EXISTS "Users can create disputes" ON public.disputes;
CREATE POLICY "Users can create disputes"
  ON public.disputes FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = complainant_id
    AND ((NOT has_role(auth.uid(), 'merchant'::app_role)) OR has_role(auth.uid(), 'admin'::app_role))
  );

-- Restrictive belt-and-suspenders policy: block merchant role from all access on each table
CREATE POLICY "Block merchant role" ON public.vendor_wallets
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((NOT has_role(auth.uid(), 'merchant'::app_role)) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK ((NOT has_role(auth.uid(), 'merchant'::app_role)) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Block merchant role" ON public.vendor_earnings_ledger
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((NOT has_role(auth.uid(), 'merchant'::app_role)) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK ((NOT has_role(auth.uid(), 'merchant'::app_role)) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Block merchant role" ON public.merchant_payouts
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((NOT has_role(auth.uid(), 'merchant'::app_role)) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK ((NOT has_role(auth.uid(), 'merchant'::app_role)) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Block merchant role" ON public.disputes
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((NOT has_role(auth.uid(), 'merchant'::app_role)) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK ((NOT has_role(auth.uid(), 'merchant'::app_role)) OR has_role(auth.uid(), 'admin'::app_role));
