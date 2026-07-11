
-- 1. amount_paid column
ALTER TABLE public.payment_links
  ADD COLUMN IF NOT EXISTS amount_paid numeric NOT NULL DEFAULT 0;

-- Backfill from historical payments
UPDATE public.payment_links pl
SET amount_paid = COALESCE(sub.total, 0)
FROM (
  SELECT link_id, SUM(amount) AS total
  FROM public.payment_link_payments
  WHERE status = 'succeeded'
  GROUP BY link_id
) sub
WHERE pl.id = sub.link_id;

-- 2. Trigger: on payment insert, bump totals + notify payee
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
  v_remaining numeric;
BEGIN
  IF NEW.status <> 'succeeded' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_link FROM public.payment_links WHERE id = NEW.link_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;

  v_new_paid := COALESCE(v_link.amount_paid, 0) + NEW.amount;
  IF v_link.amount IS NOT NULL AND v_new_paid >= v_link.amount THEN
    v_fully := true;
  END IF;

  UPDATE public.payment_links
     SET amount_paid = v_new_paid,
         used_count = COALESCE(used_count, 0) + 1,
         is_active = CASE
           WHEN v_fully THEN false
           WHEN max_uses IS NOT NULL AND COALESCE(used_count, 0) + 1 >= max_uses THEN false
           ELSE is_active
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
      'link_id', NEW.link_id,
      'payment_id', NEW.id,
      'amount', NEW.amount,
      'short_code', v_link.short_code,
      'fully_paid', v_fully,
      'remaining', v_remaining
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_payment_link_payment_insert ON public.payment_link_payments;
CREATE TRIGGER on_payment_link_payment_insert
AFTER INSERT ON public.payment_link_payments
FOR EACH ROW EXECUTE FUNCTION public.handle_payment_link_payment();

-- 3. Trigger: notify on manual deactivation (skip fully-paid + expired cases)
CREATE OR REPLACE FUNCTION public.notify_payment_link_deactivated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_active = true AND NEW.is_active = false AND NEW.created_by IS NOT NULL THEN
    IF NEW.amount IS NOT NULL AND NEW.amount_paid >= NEW.amount THEN
      RETURN NEW;
    END IF;
    IF NEW.expires_at IS NOT NULL AND NEW.expires_at < now() THEN
      RETURN NEW;
    END IF;
    INSERT INTO public.notifications(user_id, title, body, category, metadata)
    VALUES (
      NEW.created_by,
      'Payment link deactivated',
      'Your payment link "' || NEW.title || '" was deactivated.',
      'payment',
      jsonb_build_object('link_id', NEW.id, 'short_code', NEW.short_code)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_payment_link_deactivated ON public.payment_links;
CREATE TRIGGER on_payment_link_deactivated
AFTER UPDATE OF is_active ON public.payment_links
FOR EACH ROW EXECUTE FUNCTION public.notify_payment_link_deactivated();

-- 4. Expiry job
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
    WHERE is_active = true
      AND expires_at IS NOT NULL
      AND expires_at < now()
  LOOP
    UPDATE public.payment_links SET is_active = false WHERE id = r.id;
    IF r.created_by IS NOT NULL THEN
      INSERT INTO public.notifications(user_id, title, body, category, metadata)
      VALUES (
        r.created_by,
        'Payment link expired',
        'Your payment link "' || r.title || '" has expired.',
        'payment',
        jsonb_build_object('link_id', r.id, 'short_code', r.short_code)
      );
    END IF;
  END LOOP;
END;
$$;

-- Schedule every minute (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-payment-links') THEN
    PERFORM cron.schedule('expire-payment-links', '* * * * *', $c$SELECT public.expire_payment_links();$c$);
  END IF;
END $$;

-- 5. Realtime
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_links;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_link_payments;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

ALTER TABLE public.payment_links REPLICA IDENTITY FULL;
ALTER TABLE public.payment_link_payments REPLICA IDENTITY FULL;
