
-- Idempotency + refund tracking on payments
ALTER TABLE public.payment_link_payments
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS refunded_by uuid,
  ADD COLUMN IF NOT EXISTS refund_reason text,
  ADD COLUMN IF NOT EXISTS refund_transaction_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS payment_link_payments_payer_idem_uidx
  ON public.payment_link_payments (payer_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Deactivation reason on links, so refunds can reactivate only auto-deactivations
ALTER TABLE public.payment_links
  ADD COLUMN IF NOT EXISTS deactivated_reason text;

-- Recreate payment trigger to also record deactivation reason
CREATE OR REPLACE FUNCTION public.handle_payment_link_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.payment_links%ROWTYPE;
  v_new_paid numeric;
  v_fully boolean := false;
  v_max_hit boolean := false;
  v_remaining numeric;
  v_reason text;
BEGIN
  IF NEW.status <> 'succeeded' THEN RETURN NEW; END IF;

  SELECT * INTO v_link FROM public.payment_links WHERE id = NEW.link_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;

  v_new_paid := COALESCE(v_link.amount_paid, 0) + NEW.amount;
  IF v_link.amount IS NOT NULL AND v_new_paid >= v_link.amount THEN v_fully := true; END IF;
  IF v_link.max_uses IS NOT NULL AND COALESCE(v_link.used_count, 0) + 1 >= v_link.max_uses THEN v_max_hit := true; END IF;
  v_reason := CASE WHEN v_fully THEN 'fully_paid' WHEN v_max_hit THEN 'max_uses' ELSE NULL END;

  UPDATE public.payment_links
     SET amount_paid = v_new_paid,
         used_count = COALESCE(used_count, 0) + 1,
         is_active = CASE WHEN v_fully OR v_max_hit THEN false ELSE is_active END,
         deactivated_reason = CASE
           WHEN v_reason IS NOT NULL THEN v_reason
           ELSE deactivated_reason
         END
   WHERE id = NEW.link_id;

  v_remaining := CASE WHEN v_link.amount IS NOT NULL
                      THEN GREATEST(v_link.amount - v_new_paid, 0)
                      ELSE NULL END;

  INSERT INTO public.notifications(user_id, title, body, category, metadata)
  VALUES (
    NEW.payee_id,
    CASE WHEN v_fully THEN 'Payment link fully paid' ELSE 'Payment received' END,
    'You received ৳' || NEW.amount::text || ' for "' || v_link.title || '"'
      || CASE WHEN v_remaining IS NOT NULL AND NOT v_fully
              THEN '. ৳' || v_remaining::text || ' remaining.'
              ELSE '' END,
    'payment',
    jsonb_build_object(
      'link_id', NEW.link_id, 'payment_id', NEW.id, 'amount', NEW.amount,
      'short_code', v_link.short_code, 'fully_paid', v_fully, 'remaining', v_remaining
    )
  );
  RETURN NEW;
END;
$$;

-- Mark cron expirations with a reason too
CREATE OR REPLACE FUNCTION public.expire_payment_links()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id, title, short_code, created_by
    FROM public.payment_links
    WHERE is_active = true AND expires_at IS NOT NULL AND expires_at < now()
  LOOP
    UPDATE public.payment_links
      SET is_active = false, deactivated_reason = 'expired'
      WHERE id = r.id;
    IF r.created_by IS NOT NULL THEN
      INSERT INTO public.notifications(user_id, title, body, category, metadata)
      VALUES (r.created_by, 'Payment link expired',
        'Your payment link "' || r.title || '" has expired.',
        'payment', jsonb_build_object('link_id', r.id, 'short_code', r.short_code));
    END IF;
  END LOOP;
END;
$$;

-- Refund RPC used by the refund edge function
CREATE OR REPLACE FUNCTION public.refund_payment_link_payment(
  p_payment_id uuid,
  p_actor uuid,
  p_reason text,
  p_refund_txn_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pay public.payment_link_payments%ROWTYPE;
  v_link public.payment_links%ROWTYPE;
  v_new_paid numeric;
  v_reactivate boolean := false;
BEGIN
  SELECT * INTO v_pay FROM public.payment_link_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF v_pay.payee_id <> p_actor THEN RAISE EXCEPTION 'Only the payee can refund this payment'; END IF;
  IF v_pay.status <> 'succeeded' THEN RAISE EXCEPTION 'Payment is not refundable (status=%)', v_pay.status; END IF;

  SELECT * INTO v_link FROM public.payment_links WHERE id = v_pay.link_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Link not found'; END IF;

  v_new_paid := GREATEST(COALESCE(v_link.amount_paid, 0) - v_pay.amount, 0);

  IF NOT v_link.is_active
     AND v_link.deactivated_reason IN ('fully_paid', 'max_uses')
     AND (v_link.expires_at IS NULL OR v_link.expires_at > now())
     AND (v_link.amount IS NULL OR v_new_paid < v_link.amount)
     AND (v_link.max_uses IS NULL OR COALESCE(v_link.used_count, 1) - 1 < v_link.max_uses)
  THEN
    v_reactivate := true;
  END IF;

  UPDATE public.payment_links
     SET amount_paid = v_new_paid,
         used_count = GREATEST(COALESCE(used_count, 1) - 1, 0),
         is_active = CASE WHEN v_reactivate THEN true ELSE is_active END,
         deactivated_reason = CASE WHEN v_reactivate THEN NULL ELSE deactivated_reason END
   WHERE id = v_link.id;

  UPDATE public.payment_link_payments
     SET status = 'refunded',
         refunded_at = now(),
         refunded_by = p_actor,
         refund_reason = p_reason,
         refund_transaction_id = p_refund_txn_id
   WHERE id = v_pay.id;

  INSERT INTO public.notifications(user_id, title, body, category, metadata)
  VALUES
    (v_pay.payer_id, 'Payment refunded',
     'Your ৳' || v_pay.amount::text || ' payment for "' || v_link.title || '" was refunded.',
     'payment',
     jsonb_build_object('link_id', v_link.id, 'payment_id', v_pay.id, 'amount', v_pay.amount, 'reason', p_reason)),
    (v_pay.payee_id, 'Refund issued',
     'You refunded ৳' || v_pay.amount::text || ' for "' || v_link.title || '".',
     'payment',
     jsonb_build_object('link_id', v_link.id, 'payment_id', v_pay.id, 'amount', v_pay.amount, 'reason', p_reason));

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_pay.id,
    'amount', v_pay.amount,
    'reactivated', v_reactivate,
    'new_amount_paid', v_new_paid
  );
END;
$$;

REVOKE ALL ON FUNCTION public.refund_payment_link_payment(uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_payment_link_payment(uuid, uuid, text, uuid) TO service_role;
