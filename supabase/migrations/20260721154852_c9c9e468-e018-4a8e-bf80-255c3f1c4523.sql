
-- 1. Add new transaction types
ALTER TYPE public.txn_type ADD VALUE IF NOT EXISTS 'refund';
ALTER TYPE public.txn_type ADD VALUE IF NOT EXISTS 'reversal';

-- 2. Refund status column on transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS refund_status TEXT
  CHECK (refund_status IN ('refunded','reversed'));

CREATE INDEX IF NOT EXISTS idx_transactions_refund_status
  ON public.transactions(refund_status) WHERE refund_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_type_status_created
  ON public.transactions(type, status, created_at DESC);

-- 3. Admin refund RPC for paybill transactions
CREATE OR REPLACE FUNCTION public.admin_refund_paybill(
  p_txn_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin UUID;
  v_txn RECORD;
  v_settlement RECORD;
  v_balance NUMERIC;
  v_refund_total NUMERIC;
  v_new_balance NUMERIC;
  v_refund_txn_id UUID;
  v_ref TEXT;
  v_user_phone TEXT;
BEGIN
  v_admin := auth.uid();
  IF v_admin IS NULL OR NOT has_role(v_admin, 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT * INTO v_txn FROM transactions WHERE id = p_txn_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaction not found'; END IF;
  IF v_txn.type <> 'paybill' THEN
    RAISE EXCEPTION 'Only paybill transactions can be refunded through this flow';
  END IF;
  IF v_txn.status <> 'completed' THEN
    RAISE EXCEPTION 'Only completed transactions can be refunded (current: %)', v_txn.status;
  END IF;
  IF v_txn.refund_status IS NOT NULL THEN
    RAISE EXCEPTION 'Transaction already %', v_txn.refund_status;
  END IF;

  -- Guard biller settlement: cannot refund if already paid to real biller
  SELECT * INTO v_settlement FROM biller_settlements
    WHERE transaction_id = p_txn_id FOR UPDATE;
  IF FOUND AND v_settlement.status = 'paid' THEN
    RAISE EXCEPTION 'Biller settlement already paid to provider — issue a manual reversal with the biller';
  END IF;

  v_refund_total := COALESCE(v_txn.amount, 0) + COALESCE(v_txn.fee, 0);
  v_ref := 'RFD-' || COALESCE(v_txn.reference, substr(p_txn_id::text, 1, 8));

  -- Credit user balance atomically
  SELECT balance INTO v_balance FROM profiles WHERE user_id = v_txn.user_id FOR UPDATE;
  v_new_balance := COALESCE(v_balance, 0) + v_refund_total;
  UPDATE profiles SET balance = v_new_balance, updated_at = now() WHERE user_id = v_txn.user_id;

  -- Refund ledger entry (new dedicated type)
  INSERT INTO transactions (user_id, type, amount, fee, balance_after, recipient_name, description, reference, status)
  VALUES (
    v_txn.user_id, 'refund', v_refund_total, 0, v_new_balance,
    v_txn.recipient_name,
    COALESCE(p_reason, 'Bill payment refund'),
    v_ref, 'completed'
  ) RETURNING id INTO v_refund_txn_id;

  -- Mark original as reversed
  UPDATE transactions
    SET status = 'reversed', refund_status = 'reversed', updated_at = now()
    WHERE id = p_txn_id;

  -- Also stamp refund_status on the new refund txn for filter clarity
  UPDATE transactions SET refund_status = 'refunded' WHERE id = v_refund_txn_id;

  -- Update biller settlement
  IF FOUND OR v_settlement.id IS NOT NULL THEN
    UPDATE biller_settlements
      SET status = 'refunded', admin_note = COALESCE(p_reason, admin_note), updated_at = now()
      WHERE transaction_id = p_txn_id;
  END IF;

  -- In-app notification
  SELECT phone INTO v_user_phone FROM profiles WHERE user_id = v_txn.user_id;
  INSERT INTO notifications (user_id, title, body, category, metadata)
  VALUES (
    v_txn.user_id,
    'Bill payment refunded',
    '৳' || v_refund_total::text || ' has been refunded to your wallet (ref ' || v_ref || ').',
    'transaction',
    jsonb_build_object(
      'original_txn_id', p_txn_id,
      'refund_txn_id', v_refund_txn_id,
      'amount', v_refund_total,
      'reference', v_ref,
      'reason', p_reason
    )
  );

  -- Audit log
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (v_admin, 'paybill_refund', 'transaction', p_txn_id::text,
          jsonb_build_object('refund_txn_id', v_refund_txn_id, 'amount', v_refund_total, 'reason', p_reason));

  RETURN json_build_object(
    'success', true,
    'refund_txn_id', v_refund_txn_id,
    'reference', v_ref,
    'amount', v_refund_total,
    'user_id', v_txn.user_id,
    'user_phone', v_user_phone,
    'new_balance', v_new_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_refund_paybill(UUID, TEXT) TO authenticated;

-- 4. Backfill: mark historic transactions consistently
UPDATE public.transactions
  SET refund_status = 'reversed'
  WHERE status = 'reversed' AND refund_status IS NULL;
