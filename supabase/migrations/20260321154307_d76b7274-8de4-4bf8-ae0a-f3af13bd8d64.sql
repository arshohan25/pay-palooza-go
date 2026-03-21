
-- 1. Create merchant_refunds table
CREATE TABLE public.merchant_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  order_num TEXT,
  customer_name TEXT,
  customer_user_id UUID,
  amount NUMERIC NOT NULL,
  refund_type TEXT NOT NULL DEFAULT 'full',
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Validation trigger for status and refund_type
CREATE OR REPLACE FUNCTION public.validate_merchant_refund()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid refund status';
  END IF;
  IF NEW.refund_type NOT IN ('full', 'partial') THEN
    RAISE EXCEPTION 'Invalid refund type: must be full or partial';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_merchant_refund
  BEFORE INSERT OR UPDATE ON public.merchant_refunds
  FOR EACH ROW EXECUTE FUNCTION public.validate_merchant_refund();

-- 3. Auto-update updated_at
CREATE TRIGGER trg_merchant_refunds_updated_at
  BEFORE UPDATE ON public.merchant_refunds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. RLS
ALTER TABLE public.merchant_refunds ENABLE ROW LEVEL SECURITY;

-- Merchants can view their own refunds
CREATE POLICY "Merchants can view own refunds"
  ON public.merchant_refunds FOR SELECT TO authenticated
  USING (
    merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- Merchants can insert refunds for their own merchant
CREATE POLICY "Merchants can insert own refunds"
  ON public.merchant_refunds FOR INSERT TO authenticated
  WITH CHECK (
    merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
  );

-- Admins can update any refund (for approve/reject)
CREATE POLICY "Admins can update refunds"
  ON public.merchant_refunds FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.merchant_refunds;

-- 6. Process refund RPC (admin-only)
CREATE OR REPLACE FUNCTION public.process_merchant_refund(
  p_refund_id UUID,
  p_action TEXT,
  p_admin_note TEXT DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin_id UUID;
  v_refund RECORD;
  v_buyer_balance NUMERIC;
  v_new_balance NUMERIC;
  v_merchant_profile RECORD;
  v_merchant_balance NUMERIC;
  v_merchant_new_balance NUMERIC;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL OR NOT has_role(v_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Invalid action: must be approve or reject';
  END IF;

  -- Lock refund row
  SELECT * INTO v_refund FROM merchant_refunds WHERE id = p_refund_id FOR UPDATE;
  IF v_refund.id IS NULL THEN RAISE EXCEPTION 'Refund not found'; END IF;
  IF v_refund.status != 'pending' THEN RAISE EXCEPTION 'Refund already processed'; END IF;

  IF p_action = 'approve' THEN
    -- Credit buyer wallet
    SELECT balance INTO v_buyer_balance FROM profiles WHERE user_id = v_refund.customer_user_id FOR UPDATE;
    IF v_buyer_balance IS NULL THEN RAISE EXCEPTION 'Buyer profile not found'; END IF;

    v_new_balance := v_buyer_balance + v_refund.amount;
    UPDATE profiles SET balance = v_new_balance WHERE user_id = v_refund.customer_user_id;

    -- Record addmoney transaction for buyer
    INSERT INTO transactions (user_id, type, amount, fee, balance_after, description, reference, status)
    VALUES (v_refund.customer_user_id, 'addmoney', v_refund.amount, 0, v_new_balance,
      'Refund from merchant for order ' || COALESCE(v_refund.order_num, 'N/A'),
      v_refund.id::text, 'completed');

    -- Debit merchant wallet
    SELECT p.user_id, p.balance INTO v_merchant_profile
    FROM profiles p
    JOIN merchants m ON m.user_id = p.user_id
    WHERE m.id = v_refund.merchant_id
    FOR UPDATE OF p;

    IF v_merchant_profile.user_id IS NOT NULL THEN
      v_merchant_new_balance := GREATEST(v_merchant_profile.balance - v_refund.amount, 0);
      UPDATE profiles SET balance = v_merchant_new_balance WHERE user_id = v_merchant_profile.user_id;

      INSERT INTO transactions (user_id, type, amount, fee, balance_after, description, reference, status)
      VALUES (v_merchant_profile.user_id, 'send', v_refund.amount, 0, v_merchant_new_balance,
        'Refund issued for order ' || COALESCE(v_refund.order_num, 'N/A'),
        v_refund.id::text, 'completed');
    END IF;

    -- Notify buyer
    INSERT INTO notifications (user_id, title, body, category, metadata)
    VALUES (v_refund.customer_user_id,
      '💰 Refund of ৳' || v_refund.amount || ' Received',
      'Your refund for order ' || COALESCE(v_refund.order_num, 'N/A') || ' has been processed.',
      'transaction',
      jsonb_build_object('refund_id', v_refund.id, 'amount', v_refund.amount));
  END IF;

  -- Update refund status
  UPDATE merchant_refunds SET
    status = CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END,
    admin_note = p_admin_note,
    reviewed_by = v_admin_id,
    reviewed_at = now(),
    updated_at = now()
  WHERE id = p_refund_id;

  -- Audit log
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (v_admin_id, 'merchant_refund_' || p_action, 'merchant_refund', p_refund_id,
    jsonb_build_object(
      'amount', v_refund.amount,
      'merchant_id', v_refund.merchant_id,
      'customer_user_id', v_refund.customer_user_id,
      'order_num', v_refund.order_num,
      'reason', v_refund.reason
    ));

  RETURN json_build_object('success', true, 'action', p_action, 'refund_id', p_refund_id);
END;
$$;
