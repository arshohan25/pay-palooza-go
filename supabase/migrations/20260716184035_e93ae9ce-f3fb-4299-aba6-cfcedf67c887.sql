
CREATE TABLE IF NOT EXISTS public.treasury_reconciliation_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  txn_id uuid NOT NULL,
  txn_user_id uuid NOT NULL,
  txn_reference text,
  expected_amount numeric NOT NULL DEFAULT 0,
  ledger_amount numeric NOT NULL DEFAULT 0,
  matches boolean NOT NULL,
  entries jsonb NOT NULL DEFAULT '[]'::jsonb,
  checked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.treasury_reconciliation_checks TO authenticated;
GRANT ALL ON public.treasury_reconciliation_checks TO service_role;

ALTER TABLE public.treasury_reconciliation_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners or admins can view checks"
  ON public.treasury_reconciliation_checks FOR SELECT
  USING (auth.uid() = txn_user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_treasury_recon_checks_txn ON public.treasury_reconciliation_checks (txn_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.reconcile_txn_treasury(p_txn_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_txn RECORD;
  v_entries jsonb;
  v_ledger_total numeric := 0;
  v_expected numeric := 0;
  v_is_admin boolean;
  v_matches boolean;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT id, user_id, type::text AS type, amount, fee, commission, reference, description, created_at
    INTO v_txn FROM transactions WHERE id = p_txn_id;
  IF v_txn.id IS NULL THEN RAISE EXCEPTION 'Transaction not found'; END IF;

  v_is_admin := has_role(v_uid, 'admin'::app_role);
  IF v_txn.user_id <> v_uid AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_txn.type = 'receive' THEN
    v_expected := COALESCE(v_txn.fee, 0);
  ELSIF v_txn.type IN ('cashin','cashout') THEN
    v_expected := COALESCE(v_txn.commission, 0);
  ELSE
    v_expected := COALESCE(v_txn.fee, 0) + COALESCE(v_txn.commission, 0);
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', l.id, 'type', l.type, 'amount', l.amount,
    'balance_after', l.balance_after, 'description', l.description,
    'created_at', l.created_at
  ) ORDER BY l.created_at), '[]'::jsonb),
  COALESCE(SUM(CASE WHEN l.type::text = 'earning' THEN l.amount
                    WHEN l.type::text = 'payout' THEN -l.amount
                    ELSE 0 END), 0)
  INTO v_entries, v_ledger_total
  FROM treasury_ledger l
  WHERE v_txn.reference IS NOT NULL AND l.reference = v_txn.reference;

  v_matches := v_expected = v_ledger_total;

  INSERT INTO treasury_reconciliation_checks
    (txn_id, txn_user_id, txn_reference, expected_amount, ledger_amount, matches, entries, checked_by)
  VALUES
    (v_txn.id, v_txn.user_id, v_txn.reference, v_expected, v_ledger_total, v_matches, v_entries, v_uid);

  RETURN json_build_object(
    'txn_id', v_txn.id,
    'txn_type', v_txn.type,
    'txn_reference', v_txn.reference,
    'expected_amount', v_expected,
    'ledger_amount', v_ledger_total,
    'matches', v_matches,
    'entries', v_entries
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_txn_treasury(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_txn_reconciliation_checks(p_txn_id uuid, p_limit int DEFAULT 20)
RETURNS SETOF public.treasury_reconciliation_checks
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_owner uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT user_id INTO v_owner FROM transactions WHERE id = p_txn_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Transaction not found'; END IF;
  IF v_owner <> v_uid AND NOT has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT * FROM treasury_reconciliation_checks
    WHERE txn_id = p_txn_id
    ORDER BY created_at DESC
    LIMIT GREATEST(1, LEAST(p_limit, 100));
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_txn_reconciliation_checks(uuid, int) TO authenticated;
