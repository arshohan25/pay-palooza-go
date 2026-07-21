
CREATE TABLE IF NOT EXISTS public.transaction_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  status text,
  provider_ref text,
  note text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_txn_events_txn ON public.transaction_events(transaction_id, created_at);
CREATE INDEX IF NOT EXISTS idx_txn_events_type ON public.transaction_events(event_type, created_at DESC);

GRANT SELECT ON public.transaction_events TO authenticated;
GRANT ALL ON public.transaction_events TO service_role;
ALTER TABLE public.transaction_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view events for their transactions"
  ON public.transaction_events FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND t.user_id = auth.uid())
  );
CREATE POLICY "Admins manage transaction events"
  ON public.transaction_events FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.biller_settlements
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS provider_attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;

ALTER TABLE public.biller_settlements DROP CONSTRAINT IF EXISTS biller_settlements_status_check;
ALTER TABLE public.biller_settlements
  ADD CONSTRAINT biller_settlements_status_check
  CHECK (status = ANY (ARRAY['pending','queued','paid','failed','refunded']));

CREATE UNIQUE INDEX IF NOT EXISTS uq_biller_settlements_idem
  ON public.biller_settlements(idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.log_transaction_event(
  p_transaction_id uuid, p_event_type text, p_status text DEFAULT NULL,
  p_provider_ref text DEFAULT NULL, p_note text DEFAULT NULL, p_meta jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.transaction_events(transaction_id, event_type, status, provider_ref, note, meta, created_by)
  VALUES (p_transaction_id, p_event_type, p_status, p_provider_ref, p_note, COALESCE(p_meta,'{}'::jsonb), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.log_transaction_event(uuid,text,text,text,text,jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trg_txn_emit_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.transaction_events(transaction_id, event_type, status, note, meta)
    VALUES (NEW.id, 'created', NEW.status, 'Transaction created',
            jsonb_build_object('type', NEW.type, 'amount', NEW.amount, 'reference', NEW.reference));
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.transaction_events(transaction_id, event_type, status, note)
      VALUES (NEW.id, 'status_change', NEW.status,
              format('Status: %s → %s', COALESCE(OLD.status,'-'), COALESCE(NEW.status,'-')));
    END IF;
    IF NEW.refund_status IS DISTINCT FROM OLD.refund_status AND NEW.refund_status IS NOT NULL THEN
      INSERT INTO public.transaction_events(transaction_id, event_type, status, note)
      VALUES (NEW.id, NEW.refund_status, NEW.status, format('Refund status: %s', NEW.refund_status));
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_txn_emit_event ON public.transactions;
CREATE TRIGGER trg_txn_emit_event
AFTER INSERT OR UPDATE OF status, refund_status ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.trg_txn_emit_event();

CREATE OR REPLACE FUNCTION public.trg_biller_settlement_emit_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.transaction_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.transaction_events(transaction_id, event_type, status, provider_ref, note, meta)
    VALUES (NEW.transaction_id, 'settlement_created', NEW.status, NEW.provider_ref,
            format('Settlement %s', NEW.status),
            jsonb_build_object('settlement_id', NEW.id, 'biller', NEW.biller_name));
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status OR NEW.provider_ref IS DISTINCT FROM OLD.provider_ref THEN
      INSERT INTO public.transaction_events(transaction_id, event_type, status, provider_ref, note, meta)
      VALUES (NEW.transaction_id,
              CASE WHEN NEW.status='paid' THEN 'provider_paid'
                   WHEN NEW.status='failed' THEN 'provider_failed'
                   WHEN NEW.status='refunded' THEN 'settlement_refunded'
                   WHEN NEW.status='queued' THEN 'provider_queued'
                   ELSE 'settlement_update' END,
              NEW.status, NEW.provider_ref,
              COALESCE(NEW.admin_note, format('Settlement → %s', NEW.status)),
              jsonb_build_object('settlement_id', NEW.id, 'attempts', NEW.provider_attempts));
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_biller_settlement_emit_event ON public.biller_settlements;
CREATE TRIGGER trg_biller_settlement_emit_event
AFTER INSERT OR UPDATE ON public.biller_settlements
FOR EACH ROW EXECUTE FUNCTION public.trg_biller_settlement_emit_event();

CREATE OR REPLACE FUNCTION public.admin_refund_transaction(
  p_txn_id uuid, p_reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tx public.transactions%ROWTYPE;
  v_new_balance numeric;
  v_settlement public.biller_settlements%ROWTYPE;
  v_has_settlement boolean := false;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
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
       SET status='refunded', admin_note = COALESCE(p_reason,'Refunded by admin'), updated_at = now()
     WHERE transaction_id = p_txn_id;
  END IF;

  INSERT INTO public.transaction_events(transaction_id, event_type, status, note, meta, created_by)
  VALUES (p_txn_id, 'refunded', 'reversed', COALESCE(p_reason,'Refunded by admin'),
          jsonb_build_object('new_balance', v_new_balance), auth.uid());

  INSERT INTO public.notifications(user_id, title, message, type, metadata)
  VALUES (v_tx.user_id, 'Refund processed',
          format('৳%s refunded to your wallet (%s).', v_tx.amount, COALESCE(v_tx.reference,'')),
          'transaction',
          jsonb_build_object('txn_id', p_txn_id, 'reason', p_reason));

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END $$;
GRANT EXECUTE ON FUNCTION public.admin_refund_transaction(uuid,text) TO authenticated;

-- Orphan paybills view (missing/failed settlement)
CREATE OR REPLACE VIEW public.v_orphan_paybills AS
SELECT t.id AS transaction_id, t.user_id, t.amount, t.fee, t.status, t.refund_status,
       t.reference, t.recipient_name, t.recipient_phone, t.description, t.created_at,
       bs.id AS settlement_id, bs.status AS settlement_status, bs.provider_ref,
       CASE WHEN bs.id IS NULL THEN 'missing_settlement'
            WHEN bs.status = 'failed' THEN 'settlement_failed'
            WHEN bs.status = 'pending' AND t.created_at < now() - interval '1 hour' THEN 'stale_pending'
            ELSE 'other' END AS flag
FROM public.transactions t
LEFT JOIN public.biller_settlements bs ON bs.transaction_id = t.id
WHERE t.type::text = 'paybill'
  AND t.status = 'completed'
  AND COALESCE(t.refund_status,'') NOT IN ('refunded','reversed')
  AND (bs.id IS NULL OR bs.status IN ('failed','pending'));

GRANT SELECT ON public.v_orphan_paybills TO authenticated;

-- Orphan donations view (donation transactions without a donation record)
CREATE OR REPLACE VIEW public.v_orphan_donations AS
SELECT t.id AS transaction_id, t.user_id, t.amount, t.status, t.refund_status,
       t.reference, t.recipient_name, t.description, t.created_at
FROM public.transactions t
LEFT JOIN public.donations d ON d.transaction_id = t.id
WHERE t.status = 'completed'
  AND COALESCE(t.refund_status,'') NOT IN ('refunded','reversed')
  AND (t.description ILIKE 'donation%' OR t.description ILIKE '%donate%')
  AND d.id IS NULL;

GRANT SELECT ON public.v_orphan_donations TO authenticated;
