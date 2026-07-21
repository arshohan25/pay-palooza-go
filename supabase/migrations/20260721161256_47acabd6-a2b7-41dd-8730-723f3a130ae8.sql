
-- 1. Dispute + refund-lock columns on biller_settlements
ALTER TABLE public.biller_settlements
  ADD COLUMN IF NOT EXISTS dispute_status text NOT NULL DEFAULT 'none'
    CHECK (dispute_status IN ('none','disputed','evidence_pending','evidence_received','resolved','rejected')),
  ADD COLUMN IF NOT EXISTS dispute_reason text,
  ADD COLUMN IF NOT EXISTS dispute_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispute_opened_by uuid,
  ADD COLUMN IF NOT EXISTS evidence_url text,
  ADD COLUMN IF NOT EXISTS evidence_note text,
  ADD COLUMN IF NOT EXISTS evidence_received_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispute_resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispute_resolved_by uuid,
  ADD COLUMN IF NOT EXISTS refund_lock_key uuid,
  ADD COLUMN IF NOT EXISTS refund_locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_locked_by uuid,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS refunded_by uuid;

CREATE UNIQUE INDEX IF NOT EXISTS biller_settlements_refund_lock_uidx
  ON public.biller_settlements(refund_lock_key) WHERE refund_lock_key IS NOT NULL;

-- 2. Role helper
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles))
$$;

-- 3. Dispute workflow RPCs
CREATE OR REPLACE FUNCTION public.admin_open_paybill_dispute(
  p_settlement_id uuid, p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.biller_settlements%ROWTYPE;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['admin','compliance','risk','finance']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorized to open disputes';
  END IF;
  SELECT * INTO v_row FROM public.biller_settlements WHERE id = p_settlement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Settlement not found'; END IF;
  IF v_row.dispute_status IN ('disputed','evidence_pending','evidence_received') THEN
    RAISE EXCEPTION 'Dispute already open (%).', v_row.dispute_status;
  END IF;
  IF v_row.status = 'refunded' THEN
    RAISE EXCEPTION 'Cannot dispute a refunded settlement';
  END IF;

  UPDATE public.biller_settlements SET
    dispute_status = 'evidence_pending',
    dispute_reason = p_reason,
    dispute_opened_at = now(),
    dispute_opened_by = auth.uid(),
    updated_at = now()
  WHERE id = p_settlement_id;

  IF v_row.transaction_id IS NOT NULL THEN
    INSERT INTO public.transaction_events(transaction_id, event_type, status, note, meta, created_by)
    VALUES (v_row.transaction_id, 'dispute_opened', 'disputed', p_reason,
            jsonb_build_object('settlement_id', p_settlement_id), auth.uid());
  END IF;
  RETURN jsonb_build_object('success', true, 'dispute_status', 'evidence_pending');
END $$;

CREATE OR REPLACE FUNCTION public.admin_submit_dispute_evidence(
  p_settlement_id uuid, p_evidence_url text, p_provider_ref text DEFAULT NULL, p_note text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.biller_settlements%ROWTYPE;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['admin','compliance','risk','finance','support']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF COALESCE(p_evidence_url,'') = '' THEN RAISE EXCEPTION 'Evidence URL required'; END IF;
  SELECT * INTO v_row FROM public.biller_settlements WHERE id = p_settlement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Settlement not found'; END IF;
  IF v_row.dispute_status NOT IN ('evidence_pending','disputed') THEN
    RAISE EXCEPTION 'No open dispute awaiting evidence';
  END IF;

  UPDATE public.biller_settlements SET
    dispute_status = 'evidence_received',
    evidence_url = p_evidence_url,
    evidence_note = p_note,
    evidence_received_at = now(),
    provider_ref = COALESCE(p_provider_ref, provider_ref),
    updated_at = now()
  WHERE id = p_settlement_id;

  IF v_row.transaction_id IS NOT NULL THEN
    INSERT INTO public.transaction_events(transaction_id, event_type, status, note, meta, created_by)
    VALUES (v_row.transaction_id, 'dispute_evidence', v_row.status, p_note,
            jsonb_build_object('evidence_url', p_evidence_url, 'provider_ref', p_provider_ref), auth.uid());
  END IF;
  RETURN jsonb_build_object('success', true);
END $$;

CREATE OR REPLACE FUNCTION public.admin_resolve_paybill_dispute(
  p_settlement_id uuid, p_outcome text, p_note text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.biller_settlements%ROWTYPE;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['admin','compliance','finance']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorized to resolve disputes';
  END IF;
  IF p_outcome NOT IN ('resolved','rejected') THEN
    RAISE EXCEPTION 'Outcome must be resolved or rejected';
  END IF;
  SELECT * INTO v_row FROM public.biller_settlements WHERE id = p_settlement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Settlement not found'; END IF;
  IF v_row.dispute_status NOT IN ('evidence_received','evidence_pending','disputed') THEN
    RAISE EXCEPTION 'No open dispute';
  END IF;
  IF v_row.dispute_status <> 'evidence_received' AND p_outcome = 'resolved' THEN
    RAISE EXCEPTION 'Provider evidence required before resolving';
  END IF;

  UPDATE public.biller_settlements SET
    dispute_status = p_outcome,
    dispute_resolved_at = now(),
    dispute_resolved_by = auth.uid(),
    admin_note = COALESCE(p_note, admin_note),
    updated_at = now()
  WHERE id = p_settlement_id;

  IF v_row.transaction_id IS NOT NULL THEN
    INSERT INTO public.transaction_events(transaction_id, event_type, status, note, meta, created_by)
    VALUES (v_row.transaction_id, 'dispute_' || p_outcome, v_row.status, p_note,
            jsonb_build_object('settlement_id', p_settlement_id), auth.uid());
  END IF;
  RETURN jsonb_build_object('success', true, 'dispute_status', p_outcome);
END $$;

-- 4. Harden admin_refund_transaction — role-gated + lock + dispute check
CREATE OR REPLACE FUNCTION public.admin_refund_transaction(p_txn_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tx public.transactions%ROWTYPE;
  v_new_balance numeric;
  v_settlement public.biller_settlements%ROWTYPE;
  v_has_settlement boolean := false;
  v_lock uuid := gen_random_uuid();
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['admin','finance','compliance']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorized to approve refunds';
  END IF;

  SELECT * INTO v_tx FROM public.transactions WHERE id = p_txn_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaction not found'; END IF;
  IF v_tx.refund_status IN ('refunded','reversed') THEN
    RAISE EXCEPTION 'Transaction already %', v_tx.refund_status;
  END IF;
  IF v_tx.type::text NOT IN ('paybill','payment','recharge','addmoney','banktransfer') THEN
    RAISE EXCEPTION 'Refund not supported for type %', v_tx.type;
  END IF;

  SELECT * INTO v_settlement FROM public.biller_settlements WHERE transaction_id = p_txn_id FOR UPDATE;
  IF FOUND THEN
    v_has_settlement := true;
    IF v_settlement.status = 'paid' THEN
      RAISE EXCEPTION 'Cannot refund — biller already paid';
    END IF;
    IF v_settlement.status = 'refunded' OR v_settlement.refund_lock_key IS NOT NULL THEN
      RAISE EXCEPTION 'Refund already in progress or completed for this settlement';
    END IF;
    IF v_settlement.dispute_status IN ('disputed','evidence_pending','evidence_received') THEN
      RAISE EXCEPTION 'Resolve the open dispute before refunding';
    END IF;

    -- Acquire lock (unique index guarantees single winner across concurrent calls)
    UPDATE public.biller_settlements
       SET refund_lock_key = v_lock, refund_locked_at = now(), refund_locked_by = auth.uid()
     WHERE id = v_settlement.id AND refund_lock_key IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Refund already in progress for this settlement';
    END IF;
  END IF;

  SELECT public.credit_user_balance(v_tx.user_id, (v_tx.amount + COALESCE(v_tx.fee,0))::numeric) INTO v_new_balance;

  INSERT INTO public.transactions(user_id, type, amount, fee, status, description, reference, recipient_name, recipient_phone, refund_status)
  VALUES (v_tx.user_id, 'reversal'::txn_type, v_tx.amount, 0, 'completed',
          format('Reversal for %s', COALESCE(v_tx.reference, v_tx.id::text)),
          'RV-' || substring(v_tx.id::text, 1, 8),
          v_tx.recipient_name, v_tx.recipient_phone, 'refunded');

  UPDATE public.transactions SET status='reversed', refund_status='reversed', updated_at=now() WHERE id = p_txn_id;

  IF v_has_settlement THEN
    UPDATE public.biller_settlements
       SET status='refunded',
           refunded_at = now(),
           refunded_by = auth.uid(),
           admin_note = COALESCE(p_reason, admin_note),
           updated_at = now()
     WHERE id = v_settlement.id;
  END IF;

  INSERT INTO public.transaction_events(transaction_id, event_type, status, note, meta, created_by)
  VALUES (p_txn_id, 'refunded', 'reversed', COALESCE(p_reason,'Refunded by admin'),
          jsonb_build_object('new_balance', v_new_balance, 'lock', v_lock), auth.uid());

  INSERT INTO public.notifications(user_id, title, message, type, metadata)
  VALUES (v_tx.user_id, 'Refund processed',
          format('৳%s refunded to your wallet (%s).', v_tx.amount, COALESCE(v_tx.reference,'')),
          'transaction',
          jsonb_build_object('txn_id', p_txn_id, 'reason', p_reason));

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance, 'lock', v_lock);
END $$;

-- 5. Audit export gate
CREATE OR REPLACE FUNCTION public.admin_can_export_audit()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_any_role(auth.uid(), ARRAY['admin','audit','compliance','finance']::app_role[])
$$;

-- 6. Webhook event ledger (dedup + spoof protection)
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL,
  event_type text,
  reference text,
  signature text,
  payload jsonb NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  result text,
  UNIQUE (provider, event_id)
);
GRANT SELECT ON public.webhook_events TO authenticated;
GRANT ALL ON public.webhook_events TO service_role;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read webhook events" ON public.webhook_events
  FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','audit','compliance']::app_role[]));
