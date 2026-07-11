
ALTER TABLE public.payment_link_payments
  ADD COLUMN IF NOT EXISTS refunded_amount numeric NOT NULL DEFAULT 0;

-- Backfill: fully-refunded rows should have refunded_amount = amount
UPDATE public.payment_link_payments
   SET refunded_amount = amount
 WHERE status = 'refunded' AND refunded_amount = 0;

CREATE OR REPLACE FUNCTION public.refund_payment_link_payment(
  p_payment_id uuid,
  p_actor uuid,
  p_reason text,
  p_refund_txn_id uuid,
  p_amount numeric DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pay public.payment_link_payments%ROWTYPE;
  v_link public.payment_links%ROWTYPE;
  v_available numeric;
  v_amount numeric;
  v_new_refunded numeric;
  v_new_paid numeric;
  v_fully boolean;
  v_new_status text;
  v_reactivate boolean := false;
BEGIN
  SELECT * INTO v_pay FROM public.payment_link_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF v_pay.payee_id <> p_actor THEN RAISE EXCEPTION 'Only the payee can refund this payment'; END IF;
  IF v_pay.status NOT IN ('succeeded', 'partially_refunded') THEN
    RAISE EXCEPTION 'Payment is not refundable (status=%)', v_pay.status;
  END IF;

  v_available := v_pay.amount - COALESCE(v_pay.refunded_amount, 0);
  IF v_available <= 0 THEN RAISE EXCEPTION 'Payment has already been fully refunded'; END IF;

  v_amount := COALESCE(p_amount, v_available);
  IF v_amount <= 0 THEN RAISE EXCEPTION 'Refund amount must be positive'; END IF;
  IF v_amount > v_available + 0.00001 THEN
    RAISE EXCEPTION 'Refund amount exceeds available (%). Max is %', v_available, v_available;
  END IF;

  v_new_refunded := COALESCE(v_pay.refunded_amount, 0) + v_amount;
  v_fully := v_new_refunded >= v_pay.amount;
  v_new_status := CASE WHEN v_fully THEN 'refunded' ELSE 'partially_refunded' END;

  SELECT * INTO v_link FROM public.payment_links WHERE id = v_pay.link_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Link not found'; END IF;

  v_new_paid := GREATEST(COALESCE(v_link.amount_paid, 0) - v_amount, 0);

  IF NOT v_link.is_active
     AND v_link.deactivated_reason IN ('fully_paid', 'max_uses')
     AND (v_link.expires_at IS NULL OR v_link.expires_at > now())
     AND (v_link.amount IS NULL OR v_new_paid < v_link.amount)
     AND (v_link.max_uses IS NULL
          OR GREATEST(COALESCE(v_link.used_count, 0) - CASE WHEN v_fully THEN 1 ELSE 0 END, 0) < v_link.max_uses)
  THEN
    v_reactivate := true;
  END IF;

  UPDATE public.payment_links
     SET amount_paid = v_new_paid,
         used_count = CASE WHEN v_fully THEN GREATEST(COALESCE(used_count, 1) - 1, 0) ELSE used_count END,
         is_active = CASE WHEN v_reactivate THEN true ELSE is_active END,
         deactivated_reason = CASE WHEN v_reactivate THEN NULL ELSE deactivated_reason END
   WHERE id = v_link.id;

  UPDATE public.payment_link_payments
     SET status = v_new_status,
         refunded_amount = v_new_refunded,
         refunded_at = CASE WHEN v_fully THEN now() ELSE refunded_at END,
         refunded_by = COALESCE(refunded_by, p_actor),
         refund_reason = COALESCE(NULLIF(p_reason, ''), refund_reason),
         refund_transaction_id = COALESCE(refund_transaction_id, p_refund_txn_id)
   WHERE id = v_pay.id;

  INSERT INTO public.notifications(user_id, title, body, category, metadata)
  VALUES
    (v_pay.payer_id,
     CASE WHEN v_fully THEN 'Payment refunded' ELSE 'Partial refund received' END,
     'You received a refund of ৳' || v_amount::text || ' for "' || v_link.title || '"'
       || CASE WHEN v_fully THEN '.' ELSE '. Original payment: ৳' || v_pay.amount::text || '.' END,
     'payment',
     jsonb_build_object('link_id', v_link.id, 'payment_id', v_pay.id, 'amount', v_amount,
                        'partial', NOT v_fully, 'reason', p_reason)),
    (v_pay.payee_id,
     CASE WHEN v_fully THEN 'Refund issued' ELSE 'Partial refund issued' END,
     'You refunded ৳' || v_amount::text || ' for "' || v_link.title || '".'
       || CASE WHEN v_fully THEN '' ELSE ' Remaining refundable: ৳' || (v_pay.amount - v_new_refunded)::text || '.' END,
     'payment',
     jsonb_build_object('link_id', v_link.id, 'payment_id', v_pay.id, 'amount', v_amount,
                        'partial', NOT v_fully, 'reason', p_reason));

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_pay.id,
    'amount', v_amount,
    'status', v_new_status,
    'refunded_amount', v_new_refunded,
    'refundable_remaining', v_pay.amount - v_new_refunded,
    'reactivated', v_reactivate,
    'new_amount_paid', v_new_paid,
    'fully_refunded', v_fully
  );
END;
$$;

REVOKE ALL ON FUNCTION public.refund_payment_link_payment(uuid, uuid, text, uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_payment_link_payment(uuid, uuid, text, uuid, numeric) TO service_role;
