CREATE TABLE IF NOT EXISTS public.admin_ledger_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL,
  direction text NOT NULL CHECK (direction IN ('credit','debit')),
  amount numeric NOT NULL CHECK (amount > 0),
  reason_code text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'applied' CHECK (status IN ('pending_approval','applied','rejected','failed')),
  approval_request_id uuid,
  balance_before numeric,
  balance_after numeric,
  requested_by uuid NOT NULL,
  approved_by uuid,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_ledger_adjustments TO authenticated;
GRANT ALL ON public.admin_ledger_adjustments TO service_role;

ALTER TABLE public.admin_ledger_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and finance can view ledger adjustments"
ON public.admin_ledger_adjustments FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finance'));

CREATE TRIGGER trg_admin_ledger_adjustments_updated_at
BEFORE UPDATE ON public.admin_ledger_adjustments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_admin_ledger_adj_created ON public.admin_ledger_adjustments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_ledger_adj_status ON public.admin_ledger_adjustments (status);

-- Request (and possibly auto-apply) a manual wallet adjustment
CREATE OR REPLACE FUNCTION public.admin_request_balance_adjustment(
  _target_user_id uuid,
  _direction text,
  _amount numeric,
  _reason_code text,
  _notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_before numeric;
  v_after numeric;
  v_adj_id uuid;
  v_req_id uuid;
  v_threshold numeric := 50000;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT (public.has_role(v_actor, 'admin') OR public.has_role(v_actor, 'finance')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _direction NOT IN ('credit','debit') THEN
    RAISE EXCEPTION 'Invalid direction';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;
  IF _reason_code IS NULL OR length(trim(_reason_code)) = 0 THEN
    RAISE EXCEPTION 'Reason code is required';
  END IF;

  SELECT balance INTO v_before FROM public.profiles WHERE user_id = _target_user_id;
  IF v_before IS NULL THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  IF _amount >= v_threshold THEN
    INSERT INTO public.admin_approval_requests (action_type, entity_type, entity_id, payload, reason, status, requested_by)
    VALUES ('balance_adjustment', 'user', _target_user_id::text,
            jsonb_build_object('direction', _direction, 'amount', _amount, 'reason_code', _reason_code, 'notes', _notes),
            _reason_code, 'pending', v_actor)
    RETURNING id INTO v_req_id;

    INSERT INTO public.admin_ledger_adjustments
      (target_user_id, direction, amount, reason_code, notes, status, approval_request_id, balance_before, requested_by)
    VALUES (_target_user_id, _direction, _amount, _reason_code, _notes, 'pending_approval', v_req_id, v_before, v_actor)
    RETURNING id INTO v_adj_id;

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
    VALUES (v_actor, 'balance_adjustment_requested', 'user', _target_user_id,
            jsonb_build_object('adjustment_id', v_adj_id, 'amount', _amount, 'direction', _direction, 'reason_code', _reason_code));

    RETURN jsonb_build_object('status', 'pending_approval', 'adjustment_id', v_adj_id, 'approval_request_id', v_req_id);
  END IF;

  IF _direction = 'credit' THEN
    PERFORM public.credit_user_balance(_target_user_id, _amount);
  ELSE
    IF v_before < _amount THEN
      RAISE EXCEPTION 'Insufficient balance for debit';
    END IF;
    PERFORM public.debit_user_balance(_target_user_id, _amount);
  END IF;

  SELECT balance INTO v_after FROM public.profiles WHERE user_id = _target_user_id;

  INSERT INTO public.admin_ledger_adjustments
    (target_user_id, direction, amount, reason_code, notes, status, balance_before, balance_after, requested_by, approved_by, applied_at)
  VALUES (_target_user_id, _direction, _amount, _reason_code, _notes, 'applied', v_before, v_after, v_actor, v_actor, now())
  RETURNING id INTO v_adj_id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (v_actor, 'adjust_balance', 'user', _target_user_id,
          jsonb_build_object('adjustment_id', v_adj_id, 'amount', _amount, 'direction', _direction, 'reason_code', _reason_code, 'balance_before', v_before, 'balance_after', v_after));

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (_target_user_id,
          CASE WHEN _direction = 'credit' THEN 'Wallet credited' ELSE 'Wallet adjusted' END,
          CASE WHEN _direction = 'credit' THEN 'A credit of BDT ' ELSE 'A debit of BDT ' END || _amount::text || ' was applied by support. Reason: ' || _reason_code,
          'system');

  RETURN jsonb_build_object('status', 'applied', 'adjustment_id', v_adj_id, 'balance_after', v_after);
END;
$$;

-- Second-admin review of a pending adjustment
CREATE OR REPLACE FUNCTION public.admin_review_balance_adjustment(
  _adjustment_id uuid,
  _approve boolean,
  _notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_adj public.admin_ledger_adjustments;
  v_before numeric;
  v_after numeric;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.has_role(v_actor, 'admin') THEN
    RAISE EXCEPTION 'Only an admin can review adjustments';
  END IF;

  SELECT * INTO v_adj FROM public.admin_ledger_adjustments WHERE id = _adjustment_id FOR UPDATE;
  IF v_adj.id IS NULL THEN
    RAISE EXCEPTION 'Adjustment not found';
  END IF;
  IF v_adj.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Adjustment is not pending approval';
  END IF;
  IF v_adj.requested_by = v_actor THEN
    RAISE EXCEPTION 'A different admin must approve this adjustment';
  END IF;

  IF NOT _approve THEN
    UPDATE public.admin_ledger_adjustments
      SET status = 'rejected', approved_by = v_actor, notes = COALESCE(_notes, notes), updated_at = now()
      WHERE id = _adjustment_id;
    UPDATE public.admin_approval_requests
      SET status = 'rejected', reviewed_by = v_actor, reviewed_at = now(), decision_notes = _notes
      WHERE id = v_adj.approval_request_id;
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
    VALUES (v_actor, 'balance_adjustment_rejected', 'user', v_adj.target_user_id,
            jsonb_build_object('adjustment_id', _adjustment_id, 'notes', _notes));
    RETURN jsonb_build_object('status', 'rejected', 'adjustment_id', _adjustment_id);
  END IF;

  SELECT balance INTO v_before FROM public.profiles WHERE user_id = v_adj.target_user_id;
  IF v_before IS NULL THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  IF v_adj.direction = 'credit' THEN
    PERFORM public.credit_user_balance(v_adj.target_user_id, v_adj.amount);
  ELSE
    IF v_before < v_adj.amount THEN
      RAISE EXCEPTION 'Insufficient balance for debit';
    END IF;
    PERFORM public.debit_user_balance(v_adj.target_user_id, v_adj.amount);
  END IF;

  SELECT balance INTO v_after FROM public.profiles WHERE user_id = v_adj.target_user_id;

  UPDATE public.admin_ledger_adjustments
    SET status = 'applied', approved_by = v_actor, applied_at = now(),
        balance_before = v_before, balance_after = v_after,
        notes = COALESCE(_notes, notes), updated_at = now()
    WHERE id = _adjustment_id;

  UPDATE public.admin_approval_requests
    SET status = 'approved', reviewed_by = v_actor, reviewed_at = now(), decision_notes = _notes
    WHERE id = v_adj.approval_request_id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (v_actor, 'adjust_balance', 'user', v_adj.target_user_id,
          jsonb_build_object('adjustment_id', _adjustment_id, 'amount', v_adj.amount, 'direction', v_adj.direction,
                             'reason_code', v_adj.reason_code, 'balance_before', v_before, 'balance_after', v_after,
                             'dual_approved', true));

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (v_adj.target_user_id,
          CASE WHEN v_adj.direction = 'credit' THEN 'Wallet credited' ELSE 'Wallet adjusted' END,
          CASE WHEN v_adj.direction = 'credit' THEN 'A credit of BDT ' ELSE 'A debit of BDT ' END || v_adj.amount::text || ' was applied by support. Reason: ' || v_adj.reason_code,
          'system');

  RETURN jsonb_build_object('status', 'applied', 'adjustment_id', _adjustment_id, 'balance_after', v_after);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_request_balance_adjustment(uuid, text, numeric, text, text) FROM public;
REVOKE ALL ON FUNCTION public.admin_review_balance_adjustment(uuid, boolean, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_request_balance_adjustment(uuid, text, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_balance_adjustment(uuid, boolean, text) TO authenticated;