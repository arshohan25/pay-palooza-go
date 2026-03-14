
-- ═══ Fund Requests Table ═══
CREATE TABLE public.fund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'add_money',
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  source_method TEXT,
  proof_url TEXT,
  transaction_id_proof TEXT,
  bank_name TEXT,
  account_number TEXT,
  account_holder TEXT,
  admin_note TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation trigger for status
CREATE OR REPLACE FUNCTION public.validate_fund_request_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status: must be pending, approved, or rejected';
  END IF;
  IF NEW.type NOT IN ('add_money', 'withdraw') THEN
    RAISE EXCEPTION 'Invalid type: must be add_money or withdraw';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_fund_request_status
  BEFORE INSERT OR UPDATE ON public.fund_requests
  FOR EACH ROW EXECUTE FUNCTION public.validate_fund_request_status();

-- RLS
ALTER TABLE public.fund_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fund requests"
  ON public.fund_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own fund requests"
  ON public.fund_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update fund requests"
  ON public.fund_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.fund_requests;

-- Storage bucket for proofs
INSERT INTO storage.buckets (id, name, public) VALUES ('fund-proofs', 'fund-proofs', false);

CREATE POLICY "Users can upload fund proofs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fund-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own fund proofs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'fund-proofs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));

-- ═══ Admin Approve Fund Request RPC ═══
CREATE OR REPLACE FUNCTION public.admin_approve_fund_request(p_request_id UUID, p_admin_note TEXT DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_admin_id UUID;
  v_req RECORD;
  v_balance NUMERIC;
  v_new_balance NUMERIC;
  v_treasury RECORD;
  v_new_treasury_balance NUMERIC;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL OR NOT has_role(v_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  SELECT * INTO v_req FROM fund_requests WHERE id = p_request_id FOR UPDATE;
  IF v_req.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_req.status != 'pending' THEN RAISE EXCEPTION 'Request already processed'; END IF;

  -- Lock user profile
  SELECT balance INTO v_balance FROM profiles WHERE user_id = v_req.user_id FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'User profile not found'; END IF;

  IF v_req.type = 'add_money' THEN
    v_new_balance := v_balance + v_req.amount;
    UPDATE profiles SET balance = v_new_balance WHERE user_id = v_req.user_id;

    INSERT INTO transactions (user_id, type, amount, fee, balance_after, description, reference, status)
    VALUES (v_req.user_id, 'addmoney', v_req.amount, 0, v_new_balance,
      'Add Money (Manual) via ' || COALESCE(v_req.source_method, 'unknown'),
      v_req.transaction_id_proof, 'completed');

    -- Treasury debit
    SELECT * INTO v_treasury FROM platform_treasury LIMIT 1 FOR UPDATE;
    IF v_treasury.id IS NOT NULL THEN
      v_new_treasury_balance := v_treasury.balance - v_req.amount;
      UPDATE platform_treasury SET balance = v_new_treasury_balance, updated_at = now() WHERE id = v_treasury.id;
      INSERT INTO treasury_ledger (type, amount, balance_after, counterparty_user_id, description)
      VALUES ('user_addmoney', v_req.amount, v_new_treasury_balance, v_req.user_id, 'Manual add money approved');
    END IF;

  ELSIF v_req.type = 'withdraw' THEN
    IF v_balance < v_req.amount THEN RAISE EXCEPTION 'User has insufficient balance for withdrawal'; END IF;
    v_new_balance := v_balance - v_req.amount;
    UPDATE profiles SET balance = v_new_balance WHERE user_id = v_req.user_id;

    INSERT INTO transactions (user_id, type, amount, fee, balance_after, description, reference, status)
    VALUES (v_req.user_id, 'banktransfer', v_req.amount, 0, v_new_balance,
      'Withdrawal to ' || COALESCE(v_req.bank_name, 'bank') || ' ' || COALESCE(v_req.account_number, ''),
      v_req.transaction_id_proof, 'completed');

    -- Treasury credit
    SELECT * INTO v_treasury FROM platform_treasury LIMIT 1 FOR UPDATE;
    IF v_treasury.id IS NOT NULL THEN
      v_new_treasury_balance := v_treasury.balance + v_req.amount;
      UPDATE platform_treasury SET balance = v_new_treasury_balance, total_earnings = total_earnings + v_req.amount, updated_at = now() WHERE id = v_treasury.id;
      INSERT INTO treasury_ledger (type, amount, balance_after, counterparty_user_id, description)
      VALUES ('earning', v_req.amount, v_new_treasury_balance, v_req.user_id, 'User withdrawal processed');
    END IF;
  END IF;

  -- Update request
  UPDATE fund_requests SET status = 'approved', admin_note = p_admin_note, reviewed_by = v_admin_id, reviewed_at = now(), updated_at = now()
  WHERE id = p_request_id;

  -- Notify user
  INSERT INTO notifications (user_id, title, body, category, metadata)
  VALUES (v_req.user_id,
    CASE WHEN v_req.type = 'add_money' THEN '৳' || v_req.amount || ' Added to Wallet' ELSE 'Withdrawal ৳' || v_req.amount || ' Processed' END,
    CASE WHEN v_req.type = 'add_money' THEN 'Your add money request of ৳' || v_req.amount || ' has been approved.' ELSE 'Your withdrawal of ৳' || v_req.amount || ' has been processed.' END,
    'transaction',
    jsonb_build_object('request_id', p_request_id, 'type', v_req.type, 'amount', v_req.amount));

  -- Audit log
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (v_admin_id, 'fund_request_approved', 'fund_request', p_request_id,
    jsonb_build_object('type', v_req.type, 'amount', v_req.amount, 'user_id', v_req.user_id, 'new_balance', v_new_balance));

  RETURN json_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

-- ═══ Admin Reject Fund Request RPC ═══
CREATE OR REPLACE FUNCTION public.admin_reject_fund_request(p_request_id UUID, p_admin_note TEXT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_admin_id UUID;
  v_req RECORD;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL OR NOT has_role(v_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  IF p_admin_note IS NULL OR LENGTH(TRIM(p_admin_note)) < 3 THEN
    RAISE EXCEPTION 'Rejection reason is required (min 3 characters)';
  END IF;

  SELECT * INTO v_req FROM fund_requests WHERE id = p_request_id FOR UPDATE;
  IF v_req.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_req.status != 'pending' THEN RAISE EXCEPTION 'Request already processed'; END IF;

  UPDATE fund_requests SET status = 'rejected', admin_note = p_admin_note, reviewed_by = v_admin_id, reviewed_at = now(), updated_at = now()
  WHERE id = p_request_id;

  -- Notify user
  INSERT INTO notifications (user_id, title, body, category, metadata)
  VALUES (v_req.user_id,
    CASE WHEN v_req.type = 'add_money' THEN 'Add Money Request Rejected' ELSE 'Withdrawal Request Rejected' END,
    'Your request of ৳' || v_req.amount || ' was rejected: ' || p_admin_note,
    'transaction',
    jsonb_build_object('request_id', p_request_id, 'type', v_req.type, 'amount', v_req.amount, 'reason', p_admin_note));

  -- Audit log
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (v_admin_id, 'fund_request_rejected', 'fund_request', p_request_id,
    jsonb_build_object('type', v_req.type, 'amount', v_req.amount, 'user_id', v_req.user_id, 'reason', p_admin_note));

  RETURN json_build_object('success', true);
END;
$$;
