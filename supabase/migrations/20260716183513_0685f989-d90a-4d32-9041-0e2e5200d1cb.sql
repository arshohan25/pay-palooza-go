
CREATE OR REPLACE FUNCTION public.reconcile_txn_treasury(p_txn_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_txn RECORD;
  v_entries json;
  v_ledger_total numeric := 0;
  v_expected numeric := 0;
  v_is_admin boolean;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT id, user_id, type::text AS type, amount, fee, commission, reference, description, created_at
    INTO v_txn
    FROM transactions WHERE id = p_txn_id;
  IF v_txn.id IS NULL THEN RAISE EXCEPTION 'Transaction not found'; END IF;

  v_is_admin := has_role(v_uid, 'admin'::app_role);
  IF v_txn.user_id <> v_uid AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Expected treasury delta: B2B receive fee, or cash-in agent commission
  IF v_txn.type = 'receive' THEN
    v_expected := COALESCE(v_txn.fee, 0);
  ELSIF v_txn.type IN ('cashin','cashout') THEN
    v_expected := COALESCE(v_txn.commission, 0);
  ELSE
    v_expected := COALESCE(v_txn.fee, 0) + COALESCE(v_txn.commission, 0);
  END IF;

  SELECT COALESCE(json_agg(json_build_object(
    'id', l.id, 'type', l.type, 'amount', l.amount,
    'balance_after', l.balance_after, 'description', l.description,
    'created_at', l.created_at
  ) ORDER BY l.created_at), '[]'::json),
  COALESCE(SUM(CASE WHEN l.type::text = 'earning' THEN l.amount
                    WHEN l.type::text = 'payout' THEN -l.amount
                    ELSE 0 END), 0)
  INTO v_entries, v_ledger_total
  FROM treasury_ledger l
  WHERE v_txn.reference IS NOT NULL AND l.reference = v_txn.reference;

  RETURN json_build_object(
    'txn_id', v_txn.id,
    'txn_type', v_txn.type,
    'txn_reference', v_txn.reference,
    'expected_amount', v_expected,
    'ledger_amount', v_ledger_total,
    'matches', v_expected = v_ledger_total,
    'entries', v_entries
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_txn_treasury(uuid) TO authenticated;
