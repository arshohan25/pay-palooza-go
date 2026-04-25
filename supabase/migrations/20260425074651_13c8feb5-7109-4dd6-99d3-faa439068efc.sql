-- ============================================================
-- Phase 4: Merchant + Agent/Distributor push triggers
-- ============================================================

-- Helper: send push via send-push-notification edge function (best effort)
CREATE OR REPLACE FUNCTION public._dispatch_push(
  p_user_ids uuid[],
  p_title text,
  p_body text,
  p_url text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  IF p_user_ids IS NULL OR array_length(p_user_ids, 1) IS NULL THEN
    RETURN;
  END IF;
  BEGIN
    v_url := current_setting('app.supabase_url', true);
    v_key := current_setting('app.service_role_key', true);
    IF v_url IS NULL OR v_key IS NULL THEN RETURN; END IF;

    PERFORM net.http_post(
      url := v_url || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body := jsonb_build_object(
        'user_ids', to_jsonb(p_user_ids),
        'title', p_title,
        'body',  p_body,
        'url',   p_url
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END;
$$;

-- ============================================================
-- A1: Merchant new order
-- Fires once per merchant in the order (via order_items)
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_merchant_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_owner uuid;
  v_title text;
  v_body  text;
BEGIN
  FOR r IN
    SELECT oi.merchant_id, COUNT(*) AS items, SUM(oi.subtotal) AS total
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id AND oi.merchant_id IS NOT NULL
    GROUP BY oi.merchant_id
  LOOP
    SELECT user_id INTO v_owner FROM public.merchants WHERE id = r.merchant_id;
    IF v_owner IS NULL THEN CONTINUE; END IF;

    v_title := 'New order received 🛍️';
    v_body  := format('Order #%s — %s item(s), ৳%s', NEW.order_num, r.items, COALESCE(r.total::int::text,'0'));

    INSERT INTO public.notifications (user_id, title, body, category, metadata)
    VALUES (v_owner, v_title, v_body, 'order',
      jsonb_build_object('order_id', NEW.id, 'order_num', NEW.order_num, 'merchant_id', r.merchant_id, 'event','new_order'));

    PERFORM public._dispatch_push(ARRAY[v_owner], v_title, v_body, '/merchant#orders');
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_merchant_new_order ON public.orders;
CREATE TRIGGER trg_notify_merchant_new_order
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_merchant_new_order();

-- ============================================================
-- A2: Merchant payout paid
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_merchant_payout_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_title text;
  v_body  text;
BEGIN
  IF NEW.status IN ('paid','completed','credited')
     AND COALESCE(OLD.status,'') NOT IN ('paid','completed','credited') THEN

    SELECT user_id INTO v_owner FROM public.merchants WHERE id = NEW.merchant_id;
    IF v_owner IS NULL THEN RETURN NEW; END IF;

    v_title := 'Payout received 💰';
    v_body  := format('৳%s has been credited to your account', COALESCE(NEW.amount::int::text,'0'));

    INSERT INTO public.notifications (user_id, title, body, category, metadata)
    VALUES (v_owner, v_title, v_body, 'payout',
      jsonb_build_object('payout_id', NEW.id, 'amount', NEW.amount, 'event','payout_paid'));

    PERFORM public._dispatch_push(ARRAY[v_owner], v_title, v_body, '/merchant#payouts');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_merchant_payout_paid ON public.merchant_payouts;
CREATE TRIGGER trg_notify_merchant_payout_paid
AFTER UPDATE OF status ON public.merchant_payouts
FOR EACH ROW
EXECUTE FUNCTION public.notify_merchant_payout_paid();

-- ============================================================
-- A3: Refund request submitted
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_merchant_refund_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_owner uuid;
  v_title text;
  v_body  text;
  v_order_num text;
BEGIN
  SELECT order_num INTO v_order_num FROM public.orders WHERE id = NEW.order_id;

  FOR r IN
    SELECT DISTINCT oi.merchant_id
    FROM public.order_items oi
    WHERE oi.order_id = NEW.order_id AND oi.merchant_id IS NOT NULL
  LOOP
    SELECT user_id INTO v_owner FROM public.merchants WHERE id = r.merchant_id;
    IF v_owner IS NULL THEN CONTINUE; END IF;

    v_title := 'Return requested ↩️';
    v_body  := format('Buyer requested a return for order #%s', COALESCE(v_order_num,''));

    INSERT INTO public.notifications (user_id, title, body, category, metadata)
    VALUES (v_owner, v_title, v_body, 'refund',
      jsonb_build_object('order_id', NEW.order_id, 'return_id', NEW.id, 'reason', NEW.reason, 'event','return_requested'));

    PERFORM public._dispatch_push(ARRAY[v_owner], v_title, v_body, '/merchant#refunds');
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_merchant_refund_request ON public.return_requests;
CREATE TRIGGER trg_notify_merchant_refund_request
AFTER INSERT ON public.return_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_merchant_refund_request();

-- ============================================================
-- A4: Low stock (flat threshold = 5; per-product column not present)
-- Fires only on transition from above->at-or-below threshold
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_merchant_low_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_title text;
  v_body  text;
  v_threshold int := 5;
  v_name text;
BEGIN
  IF NEW.stock IS NULL OR OLD.stock IS NULL THEN RETURN NEW; END IF;
  IF NEW.stock <= v_threshold AND OLD.stock > v_threshold THEN

    SELECT user_id INTO v_owner FROM public.merchants WHERE id = NEW.merchant_id;
    IF v_owner IS NULL THEN RETURN NEW; END IF;

    -- Get product name (column may be 'name' or 'title')
    BEGIN
      EXECUTE format('SELECT ($1).%I::text', 'name') INTO v_name USING NEW;
    EXCEPTION WHEN OTHERS THEN
      v_name := 'A product';
    END;

    v_title := 'Low stock alert ⚠️';
    v_body  := format('%s is down to %s left', COALESCE(v_name,'A product'), NEW.stock);

    INSERT INTO public.notifications (user_id, title, body, category, metadata)
    VALUES (v_owner, v_title, v_body, 'inventory',
      jsonb_build_object('product_id', NEW.id, 'stock', NEW.stock, 'event','low_stock'));

    PERFORM public._dispatch_push(ARRAY[v_owner], v_title, v_body, '/merchant#products');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_merchant_low_stock ON public.merchant_products;
CREATE TRIGGER trg_notify_merchant_low_stock
AFTER UPDATE OF stock ON public.merchant_products
FOR EACH ROW
EXECUTE FUNCTION public.notify_merchant_low_stock();

-- ============================================================
-- B1: Agent float-low (balance / max_float < 10%)
-- Tracked via profiles.balance for the agent's user
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_agent_float_low()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent RECORD;
  v_pct_old numeric;
  v_pct_new numeric;
  v_title text;
  v_body  text;
BEGIN
  -- Only fire for agent users
  SELECT a.id, a.max_float, a.user_id INTO v_agent
  FROM public.agents a
  WHERE a.user_id = NEW.user_id AND a.status = 'active'
  LIMIT 1;
  IF v_agent.id IS NULL OR v_agent.max_float IS NULL OR v_agent.max_float <= 0 THEN
    RETURN NEW;
  END IF;

  v_pct_old := (COALESCE(OLD.balance,0) / v_agent.max_float) * 100;
  v_pct_new := (COALESCE(NEW.balance,0) / v_agent.max_float) * 100;

  IF v_pct_new < 10 AND v_pct_old >= 10 THEN
    v_title := 'Float running low ⚠️';
    v_body  := format('Your float is at %s%% (৳%s left). Top up to keep serving customers.',
                      ROUND(v_pct_new)::text, COALESCE(NEW.balance::int::text,'0'));

    INSERT INTO public.notifications (user_id, title, body, category, metadata)
    VALUES (NEW.user_id, v_title, v_body, 'wallet',
      jsonb_build_object('agent_id', v_agent.id, 'balance', NEW.balance, 'max_float', v_agent.max_float, 'event','float_low'));

    PERFORM public._dispatch_push(ARRAY[NEW.user_id], v_title, v_body, '/agent');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_agent_float_low ON public.profiles;
CREATE TRIGGER trg_notify_agent_float_low
AFTER UPDATE OF balance ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.notify_agent_float_low();

-- ============================================================
-- B2: Commission credited
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_commission_credited()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_amt  numeric;
  v_title text;
  v_body  text;
  v_recipients uuid[] := ARRAY[]::uuid[];
BEGIN
  -- Agent
  IF NEW.agent_id IS NOT NULL AND NEW.agent_amount > 0 THEN
    SELECT user_id INTO v_user FROM public.agents WHERE id = NEW.agent_id;
    IF v_user IS NOT NULL THEN
      v_title := 'Commission earned 💸';
      v_body  := format('৳%s commission credited from %s', COALESCE(NEW.agent_amount::numeric(10,2)::text,'0'), NEW.txn_type);
      INSERT INTO public.notifications (user_id, title, body, category, metadata)
      VALUES (v_user, v_title, v_body, 'commission',
        jsonb_build_object('commission_id', NEW.id, 'amount', NEW.agent_amount, 'role','agent','event','commission_credited'));
      PERFORM public._dispatch_push(ARRAY[v_user], v_title, v_body, '/agent#analytics');
    END IF;
  END IF;

  -- Distributor
  IF NEW.distributor_id IS NOT NULL AND NEW.distributor_amount > 0 THEN
    SELECT user_id INTO v_user FROM public.distributors WHERE id = NEW.distributor_id;
    IF v_user IS NOT NULL THEN
      v_title := 'Commission earned 💸';
      v_body  := format('৳%s commission credited from %s', COALESCE(NEW.distributor_amount::numeric(10,2)::text,'0'), NEW.txn_type);
      INSERT INTO public.notifications (user_id, title, body, category, metadata)
      VALUES (v_user, v_title, v_body, 'commission',
        jsonb_build_object('commission_id', NEW.id, 'amount', NEW.distributor_amount, 'role','distributor','event','commission_credited'));
      PERFORM public._dispatch_push(ARRAY[v_user], v_title, v_body, '/distributor');
    END IF;
  END IF;

  -- Master distributor
  IF NEW.master_distributor_id IS NOT NULL AND NEW.master_distributor_amount > 0 THEN
    SELECT user_id INTO v_user FROM public.distributors WHERE id = NEW.master_distributor_id;
    IF v_user IS NOT NULL THEN
      v_title := 'Commission earned 💸';
      v_body  := format('৳%s commission credited from %s', COALESCE(NEW.master_distributor_amount::numeric(10,2)::text,'0'), NEW.txn_type);
      INSERT INTO public.notifications (user_id, title, body, category, metadata)
      VALUES (v_user, v_title, v_body, 'commission',
        jsonb_build_object('commission_id', NEW.id, 'amount', NEW.master_distributor_amount, 'role','master_distributor','event','commission_credited'));
      PERFORM public._dispatch_push(ARRAY[v_user], v_title, v_body, '/super-distributor');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_commission_credited ON public.commission_logs;
CREATE TRIGGER trg_notify_commission_credited
AFTER INSERT ON public.commission_logs
FOR EACH ROW
EXECUTE FUNCTION public.notify_commission_credited();

-- ============================================================
-- B3: Fund request decision
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_fund_request_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_body  text;
  v_url   text;
BEGIN
  IF NEW.status NOT IN ('approved','rejected') THEN RETURN NEW; END IF;
  IF COALESCE(OLD.status,'') = NEW.status THEN RETURN NEW; END IF;
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;

  IF NEW.status = 'approved' THEN
    v_title := 'Fund request approved ✅';
    v_body  := format('৳%s has been credited to your wallet', COALESCE(NEW.amount::int::text,'0'));
  ELSE
    v_title := 'Fund request rejected ❌';
    v_body  := format('Your ৳%s request was rejected%s',
                      COALESCE(NEW.amount::int::text,'0'),
                      CASE WHEN NEW.admin_note IS NOT NULL THEN ': ' || NEW.admin_note ELSE '' END);
  END IF;

  v_url := '/account#requests';

  INSERT INTO public.notifications (user_id, title, body, category, metadata)
  VALUES (NEW.user_id, v_title, v_body, 'wallet',
    jsonb_build_object('request_id', NEW.id, 'status', NEW.status, 'amount', NEW.amount, 'event','fund_request_decision'));

  PERFORM public._dispatch_push(ARRAY[NEW.user_id], v_title, v_body, v_url);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_fund_request_decision ON public.fund_requests;
CREATE TRIGGER trg_notify_fund_request_decision
AFTER UPDATE OF status ON public.fund_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_fund_request_decision();