
-- =============================================
-- merchant_staff table
-- =============================================
CREATE TABLE public.merchant_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Viewer',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation trigger for staff role
CREATE OR REPLACE FUNCTION public.validate_merchant_staff_role()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.role NOT IN ('Manager', 'Cashier', 'Viewer') THEN
    RAISE EXCEPTION 'Invalid staff role: must be Manager, Cashier, or Viewer';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_merchant_staff_role
  BEFORE INSERT OR UPDATE ON public.merchant_staff
  FOR EACH ROW EXECUTE FUNCTION public.validate_merchant_staff_role();

CREATE TRIGGER trg_merchant_staff_updated_at
  BEFORE UPDATE ON public.merchant_staff
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.merchant_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants manage own staff"
  ON public.merchant_staff FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid()));

CREATE POLICY "Admins view all staff"
  ON public.merchant_staff FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- merchant_payouts table
-- =============================================
CREATE TABLE public.merchant_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC NOT NULL,
  bank_name TEXT,
  account_number TEXT,
  account_holder TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-generate payout reference
CREATE OR REPLACE FUNCTION public.set_payout_reference()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  v_seq INT;
BEGIN
  IF NEW.reference IS NULL THEN
    SELECT COUNT(*) + 1 INTO v_seq FROM public.merchant_payouts;
    NEW.reference := 'PO-' || LPAD(v_seq::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_payout_reference
  BEFORE INSERT ON public.merchant_payouts
  FOR EACH ROW EXECUTE FUNCTION public.set_payout_reference();

-- Validation trigger for payout status
CREATE OR REPLACE FUNCTION public.validate_merchant_payout_status()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'completed', 'rejected') THEN
    RAISE EXCEPTION 'Invalid payout status: must be pending, completed, or rejected';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_merchant_payout_status
  BEFORE INSERT OR UPDATE ON public.merchant_payouts
  FOR EACH ROW EXECUTE FUNCTION public.validate_merchant_payout_status();

CREATE TRIGGER trg_merchant_payouts_updated_at
  BEFORE UPDATE ON public.merchant_payouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.merchant_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants view own payouts"
  ON public.merchant_payouts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid()));

CREATE POLICY "Merchants create own payouts"
  ON public.merchant_payouts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid()));

CREATE POLICY "Admins manage all payouts"
  ON public.merchant_payouts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- Admin RPC: process_merchant_payout
-- =============================================
CREATE OR REPLACE FUNCTION public.process_merchant_payout(
  p_payout_id UUID,
  p_action TEXT,
  p_admin_note TEXT DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_admin_id UUID;
  v_payout RECORD;
  v_merchant_profile RECORD;
  v_merchant_balance NUMERIC;
  v_new_balance NUMERIC;
  v_treasury RECORD;
  v_new_treasury_balance NUMERIC;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL OR NOT has_role(v_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Invalid action: must be approve or reject';
  END IF;

  SELECT * INTO v_payout FROM merchant_payouts WHERE id = p_payout_id FOR UPDATE;
  IF v_payout.id IS NULL THEN RAISE EXCEPTION 'Payout not found'; END IF;
  IF v_payout.status != 'pending' THEN RAISE EXCEPTION 'Payout already processed'; END IF;

  IF p_action = 'approve' THEN
    -- Debit merchant wallet
    SELECT p.user_id, p.balance INTO v_merchant_profile
    FROM profiles p JOIN merchants m ON m.user_id = p.user_id
    WHERE m.id = v_payout.merchant_id FOR UPDATE OF p;

    IF v_merchant_profile.user_id IS NULL THEN RAISE EXCEPTION 'Merchant profile not found'; END IF;
    IF v_merchant_profile.balance < v_payout.amount THEN RAISE EXCEPTION 'Insufficient merchant balance'; END IF;

    v_new_balance := v_merchant_profile.balance - v_payout.amount;
    UPDATE profiles SET balance = v_new_balance WHERE user_id = v_merchant_profile.user_id;

    INSERT INTO transactions (user_id, type, amount, fee, balance_after, description, reference, status)
    VALUES (v_merchant_profile.user_id, 'withdraw', v_payout.amount, 0, v_new_balance,
      'Merchant payout to ' || COALESCE(v_payout.bank_name, 'bank'), v_payout.reference, 'completed');

    -- Credit treasury
    SELECT * INTO v_treasury FROM platform_treasury LIMIT 1 FOR UPDATE;
    IF v_treasury.id IS NOT NULL THEN
      v_new_treasury_balance := v_treasury.balance + v_payout.amount;
      UPDATE platform_treasury SET balance = v_new_treasury_balance, updated_at = now() WHERE id = v_treasury.id;
      INSERT INTO treasury_ledger (type, amount, balance_after, counterparty_user_id, description, reference)
      VALUES ('earning', v_payout.amount, v_new_treasury_balance, v_merchant_profile.user_id,
        'Merchant payout disbursement', v_payout.reference);
    END IF;

    -- Notify merchant
    INSERT INTO notifications (user_id, title, body, category, metadata)
    VALUES (v_merchant_profile.user_id,
      '💰 Payout ৳' || v_payout.amount || ' Processed',
      'Your payout request ' || v_payout.reference || ' has been approved and sent to your bank.',
      'transaction', jsonb_build_object('payout_id', v_payout.id, 'amount', v_payout.amount));
  ELSE
    -- Notify merchant of rejection
    SELECT p.user_id INTO v_merchant_profile
    FROM profiles p JOIN merchants m ON m.user_id = p.user_id
    WHERE m.id = v_payout.merchant_id;

    IF v_merchant_profile.user_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, body, category, metadata)
      VALUES (v_merchant_profile.user_id,
        'Payout Request Rejected',
        'Your payout request ' || v_payout.reference || ' was rejected.' ||
        CASE WHEN p_admin_note IS NOT NULL THEN ' Reason: ' || p_admin_note ELSE '' END,
        'transaction', jsonb_build_object('payout_id', v_payout.id));
    END IF;
  END IF;

  UPDATE merchant_payouts SET
    status = CASE WHEN p_action = 'approve' THEN 'completed' ELSE 'rejected' END,
    admin_note = p_admin_note,
    reviewed_by = v_admin_id,
    reviewed_at = now(),
    updated_at = now()
  WHERE id = p_payout_id;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (v_admin_id, 'merchant_payout_' || p_action, 'merchant_payout', p_payout_id,
    jsonb_build_object('amount', v_payout.amount, 'merchant_id', v_payout.merchant_id, 'reference', v_payout.reference));

  RETURN json_build_object('success', true, 'action', p_action, 'payout_id', p_payout_id);
END;
$$;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.merchant_staff;
ALTER PUBLICATION supabase_realtime ADD TABLE public.merchant_payouts;
