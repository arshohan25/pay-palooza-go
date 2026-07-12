
-- KYC exempt audit log
CREATE TABLE public.kyc_exempt_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  previous_value BOOLEAN,
  new_value BOOLEAN NOT NULL,
  changed_by UUID,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_kyc_exempt_audit_user ON public.kyc_exempt_audit(user_id, created_at DESC);
GRANT SELECT ON public.kyc_exempt_audit TO authenticated;
GRANT ALL ON public.kyc_exempt_audit TO service_role;
ALTER TABLE public.kyc_exempt_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view kyc exempt audit" ON public.kyc_exempt_audit FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users view own kyc exempt audit" ON public.kyc_exempt_audit FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.log_kyc_exempt_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.kyc_exempt IS DISTINCT FROM false THEN
      INSERT INTO public.kyc_exempt_audit(user_id, previous_value, new_value, changed_by, reason)
      VALUES (NEW.user_id, NULL, NEW.kyc_exempt, auth.uid(), 'profile created');
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.kyc_exempt IS DISTINCT FROM NEW.kyc_exempt THEN
    INSERT INTO public.kyc_exempt_audit(user_id, previous_value, new_value, changed_by, reason)
    VALUES (NEW.user_id, OLD.kyc_exempt, NEW.kyc_exempt, auth.uid(), NULL);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_log_kyc_exempt_change ON public.profiles;
CREATE TRIGGER trg_log_kyc_exempt_change
AFTER INSERT OR UPDATE OF kyc_exempt ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.log_kyc_exempt_change();

-- Bulk approve add-money fund requests
CREATE OR REPLACE FUNCTION public.admin_bulk_approve_addmoney(p_request_ids UUID[], p_admin_note TEXT DEFAULT NULL)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID;
  v_ok INT := 0;
  v_fail INT := 0;
  v_errors JSONB := '[]'::jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  FOREACH v_id IN ARRAY p_request_ids LOOP
    BEGIN
      PERFORM public.admin_approve_fund_request(v_id, p_admin_note);
      v_ok := v_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      v_fail := v_fail + 1;
      v_errors := v_errors || jsonb_build_object('id', v_id, 'error', SQLERRM);
    END;
  END LOOP;
  RETURN json_build_object('approved', v_ok, 'failed', v_fail, 'errors', v_errors);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_bulk_approve_addmoney(UUID[], TEXT) TO authenticated;

-- Cron reconciliation state table (for tracking last runs)
CREATE TABLE IF NOT EXISTS public.addmoney_reconciliation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID,
  invoice_id TEXT,
  status TEXT NOT NULL,
  detail JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_addmoney_recon_created ON public.addmoney_reconciliation_log(created_at DESC);
GRANT SELECT ON public.addmoney_reconciliation_log TO authenticated;
GRANT ALL ON public.addmoney_reconciliation_log TO service_role;
ALTER TABLE public.addmoney_reconciliation_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view recon log" ON public.addmoney_reconciliation_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
