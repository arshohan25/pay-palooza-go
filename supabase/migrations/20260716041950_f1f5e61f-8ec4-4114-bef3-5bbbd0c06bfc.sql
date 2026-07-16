
-- ─── KYC Resubmit Requests ──────────────────────────────────────────────
CREATE TABLE public.merchant_kyc_resubmit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  doc_key TEXT NOT NULL CHECK (doc_key IN ('nid_front','nid_back','trade_license','bank_statement','trade_license_number')),
  reason TEXT NOT NULL,
  requested_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX idx_mkrr_merchant ON public.merchant_kyc_resubmit_requests(merchant_id, status);

GRANT SELECT, INSERT, UPDATE ON public.merchant_kyc_resubmit_requests TO authenticated;
GRANT ALL ON public.merchant_kyc_resubmit_requests TO service_role;

ALTER TABLE public.merchant_kyc_resubmit_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage kyc resubmit requests"
  ON public.merchant_kyc_resubmit_requests FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Merchants view own kyc resubmit requests"
  ON public.merchant_kyc_resubmit_requests FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid()));

-- ─── KYC Doc Validation State ──────────────────────────────────────────
CREATE TABLE public.merchant_kyc_doc_validation_state (
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  doc_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('valid','missing','invalid')),
  reason TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (merchant_id, doc_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_kyc_doc_validation_state TO authenticated;
GRANT ALL ON public.merchant_kyc_doc_validation_state TO service_role;

ALTER TABLE public.merchant_kyc_doc_validation_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage kyc validation state"
  ON public.merchant_kyc_doc_validation_state FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Merchants view own kyc validation state"
  ON public.merchant_kyc_doc_validation_state FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid()));

-- ─── RPC: request resubmit (creates request + notification + audit) ─────
CREATE OR REPLACE FUNCTION public.request_merchant_kyc_resubmit(
  p_merchant UUID,
  p_doc TEXT,
  p_reason TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin UUID := auth.uid();
  v_owner UUID;
  v_biz TEXT;
  v_req UUID;
  v_label TEXT;
BEGIN
  IF NOT public.has_role(v_admin, 'admin') THEN
    RAISE EXCEPTION 'permission denied';
  END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'reason required';
  END IF;

  SELECT user_id, business_name INTO v_owner, v_biz FROM public.merchants WHERE id = p_merchant;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'merchant not found'; END IF;

  v_label := CASE p_doc
    WHEN 'nid_front' THEN 'NID (Front)'
    WHEN 'nid_back' THEN 'NID (Back)'
    WHEN 'trade_license' THEN 'Trade License Document'
    WHEN 'bank_statement' THEN 'Bank Statement'
    WHEN 'trade_license_number' THEN 'Trade License Number'
    ELSE p_doc
  END;

  INSERT INTO public.merchant_kyc_resubmit_requests(merchant_id, doc_key, reason, requested_by)
  VALUES (p_merchant, p_doc, btrim(p_reason), v_admin)
  RETURNING id INTO v_req;

  INSERT INTO public.notifications(user_id, title, body, category, metadata)
  VALUES (
    v_owner,
    'Action needed: resubmit ' || v_label,
    'Reason: ' || btrim(p_reason),
    'kyc',
    jsonb_build_object('merchant_id', p_merchant, 'doc_key', p_doc, 'request_id', v_req)
  );

  INSERT INTO public.merchant_audit_events(merchant_id, actor_id, event_type, from_value, to_value, reason)
  VALUES (
    p_merchant, v_admin, 'kyc_resubmit_request',
    NULL,
    jsonb_build_object('doc_key', p_doc, 'label', v_label),
    btrim(p_reason)
  );

  RETURN v_req;
END;
$$;

REVOKE ALL ON FUNCTION public.request_merchant_kyc_resubmit(UUID, TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.request_merchant_kyc_resubmit(UUID, TEXT, TEXT) TO authenticated;

-- ─── RPC: record validation (upsert; log audit only on change) ─────────
CREATE OR REPLACE FUNCTION public.record_merchant_kyc_validation(
  p_merchant UUID,
  p_doc TEXT,
  p_status TEXT,
  p_reason TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin UUID := auth.uid();
  v_prev TEXT;
  v_prev_reason TEXT;
BEGIN
  IF NOT public.has_role(v_admin, 'admin') THEN
    RAISE EXCEPTION 'permission denied';
  END IF;
  IF p_status NOT IN ('valid','missing','invalid') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  SELECT status, reason INTO v_prev, v_prev_reason
    FROM public.merchant_kyc_doc_validation_state
    WHERE merchant_id = p_merchant AND doc_key = p_doc;

  INSERT INTO public.merchant_kyc_doc_validation_state(merchant_id, doc_key, status, reason, checked_at)
  VALUES (p_merchant, p_doc, p_status, NULLIF(btrim(coalesce(p_reason,'')),''), now())
  ON CONFLICT (merchant_id, doc_key)
  DO UPDATE SET status = EXCLUDED.status, reason = EXCLUDED.reason, checked_at = now();

  IF v_prev IS DISTINCT FROM p_status OR coalesce(v_prev_reason,'') IS DISTINCT FROM coalesce(NULLIF(btrim(coalesce(p_reason,'')),''),'') THEN
    INSERT INTO public.merchant_audit_events(merchant_id, actor_id, event_type, from_value, to_value, reason)
    VALUES (
      p_merchant, v_admin, 'kyc_validation',
      jsonb_build_object('doc_key', p_doc, 'status', v_prev),
      jsonb_build_object('doc_key', p_doc, 'status', p_status),
      NULLIF(btrim(coalesce(p_reason,'')),'')
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.record_merchant_kyc_validation(UUID, TEXT, TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.record_merchant_kyc_validation(UUID, TEXT, TEXT, TEXT) TO authenticated;
