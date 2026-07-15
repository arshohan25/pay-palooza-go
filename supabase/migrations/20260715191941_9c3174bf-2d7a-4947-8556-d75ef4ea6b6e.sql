
-- ═══════════════════════════════════════════════════════════════
-- 1. Merchant audit events (chronological timeline)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.merchant_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  merchant_user_id uuid NOT NULL,
  actor_id uuid,
  event_type text NOT NULL,         -- status_change | kyc_change | kyc_upload | pricing_change | admin_note | pin_issued | approval | rejection | vendor_apply | vendor_decision
  from_value jsonb,
  to_value jsonb,
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.merchant_audit_events TO authenticated;
GRANT ALL ON public.merchant_audit_events TO service_role;

ALTER TABLE public.merchant_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view merchant audit"
  ON public.merchant_audit_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Merchants can view own audit"
  ON public.merchant_audit_events FOR SELECT TO authenticated
  USING (auth.uid() = merchant_user_id);

CREATE POLICY "Admins can insert merchant audit"
  ON public.merchant_audit_events FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_merchant_audit_merchant ON public.merchant_audit_events (merchant_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- 2. Auto-log merchant changes to audit + enforce KYC gate
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.enforce_merchant_kyc_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Whenever KYC is being set to 'verified' (new row or transition), require docs.
  IF NEW.business_kyc_status = 'verified'
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.business_kyc_status, '') <> 'verified') THEN
    IF NEW.nid_front_url IS NULL OR btrim(NEW.nid_front_url) = ''
       OR NEW.nid_back_url IS NULL OR btrim(NEW.nid_back_url) = ''
       OR NEW.trade_license_url IS NULL OR btrim(NEW.trade_license_url) = ''
       OR NEW.trade_license IS NULL OR btrim(NEW.trade_license) = '' THEN
      RAISE EXCEPTION 'KYC cannot be verified: missing required documents (NID front, NID back, trade license doc, trade license number).'
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.business_kyc_reviewed_at IS NULL THEN
      NEW.business_kyc_reviewed_at := now();
    END IF;
    IF NEW.business_kyc_reviewed_by IS NULL THEN
      NEW.business_kyc_reviewed_by := auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_merchant_kyc_gate ON public.merchants;
CREATE TRIGGER trg_enforce_merchant_kyc_gate
  BEFORE INSERT OR UPDATE ON public.merchants
  FOR EACH ROW EXECUTE FUNCTION public.enforce_merchant_kyc_gate();

CREATE OR REPLACE FUNCTION public.log_merchant_audit_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.merchant_audit_events (merchant_id, merchant_user_id, actor_id, event_type, to_value, metadata)
    VALUES (NEW.id, NEW.user_id, actor, 'created',
            jsonb_build_object('status', NEW.status, 'kyc', NEW.business_kyc_status, 'mdr', NEW.mdr_rate, 'commission', NEW.commission_rate),
            jsonb_build_object('business_name', NEW.business_name));
    RETURN NEW;
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.merchant_audit_events (merchant_id, merchant_user_id, actor_id, event_type, from_value, to_value)
    VALUES (NEW.id, NEW.user_id, actor, 'status_change',
            jsonb_build_object('status', OLD.status), jsonb_build_object('status', NEW.status));
  END IF;

  IF OLD.business_kyc_status IS DISTINCT FROM NEW.business_kyc_status THEN
    INSERT INTO public.merchant_audit_events (merchant_id, merchant_user_id, actor_id, event_type, from_value, to_value, reason)
    VALUES (NEW.id, NEW.user_id, actor, 'kyc_change',
            jsonb_build_object('kyc', OLD.business_kyc_status),
            jsonb_build_object('kyc', NEW.business_kyc_status),
            NEW.business_kyc_rejection_reason);
  END IF;

  IF OLD.mdr_rate IS DISTINCT FROM NEW.mdr_rate
     OR OLD.commission_rate IS DISTINCT FROM NEW.commission_rate
     OR OLD.settlement_frequency IS DISTINCT FROM NEW.settlement_frequency THEN
    INSERT INTO public.merchant_audit_events (merchant_id, merchant_user_id, actor_id, event_type, from_value, to_value)
    VALUES (NEW.id, NEW.user_id, actor, 'pricing_change',
            jsonb_build_object('mdr', OLD.mdr_rate, 'commission', OLD.commission_rate, 'settlement', OLD.settlement_frequency),
            jsonb_build_object('mdr', NEW.mdr_rate, 'commission', NEW.commission_rate, 'settlement', NEW.settlement_frequency));
  END IF;

  IF OLD.admin_notes IS DISTINCT FROM NEW.admin_notes AND NEW.admin_notes IS NOT NULL THEN
    INSERT INTO public.merchant_audit_events (merchant_id, merchant_user_id, actor_id, event_type, to_value)
    VALUES (NEW.id, NEW.user_id, actor, 'admin_note', jsonb_build_object('note', NEW.admin_notes));
  END IF;

  IF OLD.nid_front_url IS DISTINCT FROM NEW.nid_front_url
     OR OLD.nid_back_url IS DISTINCT FROM NEW.nid_back_url
     OR OLD.trade_license_url IS DISTINCT FROM NEW.trade_license_url
     OR OLD.bank_statement_url IS DISTINCT FROM NEW.bank_statement_url THEN
    INSERT INTO public.merchant_audit_events (merchant_id, merchant_user_id, actor_id, event_type, to_value)
    VALUES (NEW.id, NEW.user_id, actor, 'kyc_upload',
            jsonb_build_object(
              'nid_front', NEW.nid_front_url IS NOT NULL,
              'nid_back', NEW.nid_back_url IS NOT NULL,
              'trade_license_doc', NEW.trade_license_url IS NOT NULL,
              'bank_statement', NEW.bank_statement_url IS NOT NULL));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_merchant_audit ON public.merchants;
CREATE TRIGGER trg_log_merchant_audit
  AFTER INSERT OR UPDATE ON public.merchants
  FOR EACH ROW EXECUTE FUNCTION public.log_merchant_audit_change();

-- ═══════════════════════════════════════════════════════════════
-- 3. Vendor apply queue (merchant → vendor upgrade requests)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.merchant_vendor_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  store_name text NOT NULL,
  store_description text,
  product_categories text[],
  expected_monthly_orders int,
  pickup_address text,
  contact_number text,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.merchant_vendor_applications TO authenticated;
GRANT ALL ON public.merchant_vendor_applications TO service_role;

ALTER TABLE public.merchant_vendor_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants manage own vendor application"
  ON public.merchant_vendor_applications FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all vendor applications"
  ON public.merchant_vendor_applications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update vendor applications"
  ON public.merchant_vendor_applications FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_mva_status ON public.merchant_vendor_applications (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mva_user ON public.merchant_vendor_applications (user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_mva_updated ON public.merchant_vendor_applications;
CREATE TRIGGER trg_mva_updated BEFORE UPDATE ON public.merchant_vendor_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════
-- 4. Merchant temp PIN verify: expiry + single-use enforcement
-- ═══════════════════════════════════════════════════════════════
-- Called by merchant-login edge function with service role.
-- Returns 'ok' if a valid unused PIN existed and was marked used,
-- 'no_temp_pin' if the merchant has no outstanding temp PIN (regular login),
-- 'expired' or 'used' if the outstanding one is invalid.
CREATE OR REPLACE FUNCTION public.consume_merchant_temp_pin(_merchant_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  SELECT * INTO r
    FROM public.merchant_temp_pin_issues
   WHERE merchant_user_id = _merchant_user_id
     AND superseded_at IS NULL
   ORDER BY created_at DESC
   LIMIT 1;

  IF r IS NULL THEN RETURN 'no_temp_pin'; END IF;
  IF r.used_at IS NOT NULL THEN RETURN 'used'; END IF;
  IF r.expires_at <= now() THEN RETURN 'expired'; END IF;

  UPDATE public.merchant_temp_pin_issues
     SET used_at = now()
   WHERE id = r.id;
  RETURN 'ok';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_merchant_temp_pin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_merchant_temp_pin(uuid) TO service_role;

-- Same for agents (mirrors)
CREATE OR REPLACE FUNCTION public.consume_agent_temp_pin(_agent_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  SELECT * INTO r
    FROM public.agent_temp_pin_issues
   WHERE agent_user_id = _agent_user_id
     AND superseded_at IS NULL
   ORDER BY created_at DESC
   LIMIT 1;
  IF r IS NULL THEN RETURN 'no_temp_pin'; END IF;
  IF r.used_at IS NOT NULL THEN RETURN 'used'; END IF;
  IF r.expires_at <= now() THEN RETURN 'expired'; END IF;
  UPDATE public.agent_temp_pin_issues SET used_at = now() WHERE id = r.id;
  RETURN 'ok';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_agent_temp_pin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_agent_temp_pin(uuid) TO service_role;
