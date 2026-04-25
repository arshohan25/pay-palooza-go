-- Generic platform numeric thresholds, admin-managed
CREATE TABLE IF NOT EXISTS public.platform_thresholds (
  key text PRIMARY KEY,
  value numeric NOT NULL,
  label text NOT NULL,
  description text,
  unit text,
  min_value numeric,
  max_value numeric,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.platform_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read thresholds"
  ON public.platform_thresholds FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert thresholds"
  ON public.platform_thresholds FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update thresholds"
  ON public.platform_thresholds FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed defaults
INSERT INTO public.platform_thresholds (key, value, label, description, unit, min_value, max_value) VALUES
  ('merchant_low_stock_units', 5, 'Merchant low-stock alert',
    'Notify a merchant when a product''s stock drops to or below this many units.',
    'units', 1, 1000),
  ('agent_float_low_pct', 10, 'Agent float-low alert',
    'Notify an agent when their float (balance ÷ max float) drops below this percentage.',
    '%', 1, 90)
ON CONFLICT (key) DO NOTHING;

-- Safe getter usable by SECURITY DEFINER trigger functions
CREATE OR REPLACE FUNCTION public.get_threshold(p_key text, p_default numeric)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT value FROM public.platform_thresholds WHERE key = p_key LIMIT 1),
    p_default
  );
$$;

-- Refactor low-stock trigger to read from settings
CREATE OR REPLACE FUNCTION public.notify_merchant_low_stock()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_owner uuid;
  v_title text;
  v_body  text;
  v_threshold int;
  v_name text;
BEGIN
  IF NEW.stock IS NULL OR OLD.stock IS NULL THEN RETURN NEW; END IF;
  v_threshold := COALESCE(public.get_threshold('merchant_low_stock_units', 5), 5)::int;

  IF NEW.stock <= v_threshold AND OLD.stock > v_threshold THEN
    SELECT user_id INTO v_owner FROM public.merchants WHERE id = NEW.merchant_id;
    IF v_owner IS NULL THEN RETURN NEW; END IF;

    BEGIN
      EXECUTE format('SELECT ($1).%I::text', 'name') INTO v_name USING NEW;
    EXCEPTION WHEN OTHERS THEN
      v_name := 'A product';
    END;

    v_title := 'Low stock alert ⚠️';
    v_body  := format('%s is down to %s left', COALESCE(v_name,'A product'), NEW.stock);

    INSERT INTO public.notifications (user_id, title, body, category, metadata)
    VALUES (v_owner, v_title, v_body, 'inventory',
      jsonb_build_object('product_id', NEW.id, 'stock', NEW.stock, 'threshold', v_threshold, 'event','low_stock'));

    PERFORM public._dispatch_push(ARRAY[v_owner], v_title, v_body, '/merchant#products');
  END IF;
  RETURN NEW;
END;
$function$;

-- Refactor float-low trigger to read from settings
CREATE OR REPLACE FUNCTION public.notify_agent_float_low()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_agent RECORD;
  v_pct_old numeric;
  v_pct_new numeric;
  v_threshold numeric;
  v_title text;
  v_body  text;
BEGIN
  SELECT a.id, a.max_float, a.user_id INTO v_agent
  FROM public.agents a
  WHERE a.user_id = NEW.user_id AND a.status = 'active'
  LIMIT 1;
  IF v_agent.id IS NULL OR v_agent.max_float IS NULL OR v_agent.max_float <= 0 THEN
    RETURN NEW;
  END IF;

  v_threshold := COALESCE(public.get_threshold('agent_float_low_pct', 10), 10);
  v_pct_old := (COALESCE(OLD.balance,0) / v_agent.max_float) * 100;
  v_pct_new := (COALESCE(NEW.balance,0) / v_agent.max_float) * 100;

  IF v_pct_new < v_threshold AND v_pct_old >= v_threshold THEN
    v_title := 'Float running low ⚠️';
    v_body  := format('Your float is at %s%% (৳%s left). Top up to keep serving customers.',
                      ROUND(v_pct_new)::text, COALESCE(NEW.balance::int::text,'0'));

    INSERT INTO public.notifications (user_id, title, body, category, metadata)
    VALUES (NEW.user_id, v_title, v_body, 'wallet',
      jsonb_build_object('agent_id', v_agent.id, 'balance', NEW.balance,
                         'max_float', v_agent.max_float, 'threshold_pct', v_threshold, 'event','float_low'));

    PERFORM public._dispatch_push(ARRAY[NEW.user_id], v_title, v_body, '/agent');
  END IF;
  RETURN NEW;
END;
$function$;