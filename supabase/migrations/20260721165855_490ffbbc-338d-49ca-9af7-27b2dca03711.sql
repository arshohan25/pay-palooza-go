
-- 1. SLA columns
ALTER TABLE public.biller_settlements
  ADD COLUMN IF NOT EXISTS dispute_evidence_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispute_resolution_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispute_sla_alerted_at timestamptz;

-- 2. Evidence table
CREATE TABLE IF NOT EXISTS public.dispute_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id uuid NOT NULL REFERENCES public.biller_settlements(id) ON DELETE CASCADE,
  transaction_id uuid,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  file_size bigint,
  note text,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispute_evidence_settlement ON public.dispute_evidence(settlement_id);
CREATE INDEX IF NOT EXISTS idx_dispute_evidence_txn ON public.dispute_evidence(transaction_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dispute_evidence TO authenticated;
GRANT ALL ON public.dispute_evidence TO service_role;

ALTER TABLE public.dispute_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Evidence readable by admin/finance/compliance/risk/audit"
  ON public.dispute_evidence FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'finance')
    OR public.has_role(auth.uid(), 'compliance')
    OR public.has_role(auth.uid(), 'risk')
    OR public.has_role(auth.uid(), 'audit')
  );

CREATE POLICY "Evidence insertable by admin/finance/compliance/risk"
  ON public.dispute_evidence FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid() AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'finance')
      OR public.has_role(auth.uid(), 'compliance')
      OR public.has_role(auth.uid(), 'risk')
    )
  );

CREATE POLICY "Evidence deletable by admin"
  ON public.dispute_evidence FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Update open-dispute RPC to set SLA deadlines
CREATE OR REPLACE FUNCTION public.admin_open_paybill_dispute(
  p_settlement_id uuid,
  p_reason text,
  p_evidence_due_hours integer DEFAULT 48,
  p_resolution_due_days integer DEFAULT 7
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.biller_settlements%ROWTYPE;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'finance')
       OR public.has_role(auth.uid(),'compliance') OR public.has_role(auth.uid(),'risk')) THEN
    RAISE EXCEPTION 'Insufficient privileges';
  END IF;
  SELECT * INTO v_row FROM public.biller_settlements WHERE id = p_settlement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Settlement not found'; END IF;
  IF v_row.dispute_status IN ('disputed','evidence_pending','evidence_received') THEN
    RAISE EXCEPTION 'Dispute already open (%).', v_row.dispute_status;
  END IF;

  UPDATE public.biller_settlements SET
    dispute_status = 'evidence_pending',
    dispute_reason = p_reason,
    dispute_opened_at = now(),
    dispute_opened_by = auth.uid(),
    dispute_evidence_due_at = now() + make_interval(hours => COALESCE(p_evidence_due_hours, 48)),
    dispute_resolution_due_at = now() + make_interval(days => COALESCE(p_resolution_due_days, 7)),
    dispute_sla_alerted_at = NULL,
    updated_at = now()
  WHERE id = p_settlement_id;

  INSERT INTO public.transaction_events (transaction_id, event_type, status, note, actor_id, created_at)
    VALUES (v_row.transaction_id, 'dispute_opened', 'disputed', p_reason, auth.uid(), now());

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (auth.uid(), 'dispute_opened', 'biller_settlement', p_settlement_id,
            jsonb_build_object('reason', p_reason, 'evidence_due_hours', p_evidence_due_hours,
                               'resolution_due_days', p_resolution_due_days));

  RETURN jsonb_build_object('success', true, 'dispute_status', 'evidence_pending');
END $$;

-- 4. Evidence submission: accept optional file metadata + audit log
CREATE OR REPLACE FUNCTION public.admin_submit_dispute_evidence(
  p_settlement_id uuid,
  p_note text,
  p_file_path text DEFAULT NULL,
  p_file_name text DEFAULT NULL,
  p_mime_type text DEFAULT NULL,
  p_file_size bigint DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.biller_settlements%ROWTYPE;
  v_evidence_id uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'finance')
       OR public.has_role(auth.uid(),'compliance') OR public.has_role(auth.uid(),'risk')) THEN
    RAISE EXCEPTION 'Insufficient privileges';
  END IF;
  SELECT * INTO v_row FROM public.biller_settlements WHERE id = p_settlement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Settlement not found'; END IF;
  IF v_row.dispute_status NOT IN ('evidence_pending','disputed','evidence_received') THEN
    RAISE EXCEPTION 'No open dispute for this settlement (status %).', v_row.dispute_status;
  END IF;

  UPDATE public.biller_settlements SET
    dispute_status = 'evidence_received',
    updated_at = now()
  WHERE id = p_settlement_id;

  IF p_file_path IS NOT NULL THEN
    INSERT INTO public.dispute_evidence (settlement_id, transaction_id, file_path, file_name,
                                         mime_type, file_size, note, uploaded_by)
      VALUES (p_settlement_id, v_row.transaction_id, p_file_path, COALESCE(p_file_name, p_file_path),
              p_mime_type, p_file_size, p_note, auth.uid())
      RETURNING id INTO v_evidence_id;
  END IF;

  INSERT INTO public.transaction_events (transaction_id, event_type, status, note, actor_id, created_at)
    VALUES (v_row.transaction_id, 'dispute_evidence', v_row.status, p_note, auth.uid(), now());

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (auth.uid(), 'dispute_evidence_submitted', 'biller_settlement', p_settlement_id,
            jsonb_build_object('note', p_note, 'file_path', p_file_path,
                               'file_name', p_file_name, 'evidence_id', v_evidence_id));

  RETURN jsonb_build_object('success', true, 'evidence_id', v_evidence_id);
END $$;

-- 5. SLA breach checker: inserts admin notifications for overdue disputes
CREATE OR REPLACE FUNCTION public.check_paybill_dispute_sla_breaches()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row RECORD;
  v_admin RECORD;
  v_count int := 0;
  v_kind text;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'finance')
       OR public.has_role(auth.uid(),'compliance') OR public.has_role(auth.uid(),'risk')) THEN
    RAISE EXCEPTION 'Insufficient privileges';
  END IF;

  FOR v_row IN
    SELECT * FROM public.biller_settlements
    WHERE dispute_status IN ('evidence_pending','disputed','evidence_received')
      AND (
        (dispute_evidence_due_at IS NOT NULL AND now() > dispute_evidence_due_at
          AND dispute_status IN ('evidence_pending','disputed'))
        OR (dispute_resolution_due_at IS NOT NULL AND now() > dispute_resolution_due_at)
      )
      AND (dispute_sla_alerted_at IS NULL OR dispute_sla_alerted_at < now() - interval '6 hours')
  LOOP
    v_kind := CASE
      WHEN v_row.dispute_resolution_due_at IS NOT NULL AND now() > v_row.dispute_resolution_due_at
        THEN 'resolution_overdue'
      ELSE 'evidence_overdue'
    END;

    FOR v_admin IN
      SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('admin','finance','compliance','risk')
    LOOP
      INSERT INTO public.admin_notifications (admin_id, title, body, category, metadata, target_area)
        VALUES (v_admin.user_id,
                'Dispute SLA breach: ' || v_kind,
                'Paybill dispute ' || v_row.id::text || ' is past its ' ||
                  replace(v_kind, '_', ' ') || ' deadline.',
                'compliance',
                jsonb_build_object('settlement_id', v_row.id, 'transaction_id', v_row.transaction_id,
                                   'kind', v_kind, 'dispute_status', v_row.dispute_status),
                'paybill_disputes');
    END LOOP;

    UPDATE public.biller_settlements SET dispute_sla_alerted_at = now() WHERE id = v_row.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('breaches_alerted', v_count);
END $$;

-- 6. Storage RLS for dispute-evidence bucket
DROP POLICY IF EXISTS "Dispute evidence read" ON storage.objects;
DROP POLICY IF EXISTS "Dispute evidence upload" ON storage.objects;
DROP POLICY IF EXISTS "Dispute evidence delete" ON storage.objects;

CREATE POLICY "Dispute evidence read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'dispute-evidence' AND (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'finance')
    OR public.has_role(auth.uid(),'compliance') OR public.has_role(auth.uid(),'risk')
    OR public.has_role(auth.uid(),'audit')
  ));

CREATE POLICY "Dispute evidence upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dispute-evidence' AND (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'finance')
    OR public.has_role(auth.uid(),'compliance') OR public.has_role(auth.uid(),'risk')
  ));

CREATE POLICY "Dispute evidence delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'dispute-evidence' AND public.has_role(auth.uid(),'admin'));
