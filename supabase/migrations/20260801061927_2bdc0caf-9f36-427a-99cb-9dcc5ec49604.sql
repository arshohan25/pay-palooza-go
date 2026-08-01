
-- ============ FX / MULTI-CURRENCY ============
CREATE TABLE public.fx_currencies (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL DEFAULT '',
  decimals INT NOT NULL DEFAULT 2,
  mid_rate_bdt NUMERIC(18,6) NOT NULL DEFAULT 1,
  spread_bps INT NOT NULL DEFAULT 50,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  rate_source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fx_currencies TO authenticated;
GRANT ALL ON public.fx_currencies TO service_role;
ALTER TABLE public.fx_currencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fx_currencies_read" ON public.fx_currencies FOR SELECT TO authenticated USING (true);
CREATE POLICY "fx_currencies_admin" ON public.fx_currencies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'finance'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'finance'));

CREATE TABLE public.fx_rate_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL REFERENCES public.fx_currencies(code) ON DELETE CASCADE,
  old_rate NUMERIC(18,6),
  new_rate NUMERIC(18,6) NOT NULL,
  old_spread_bps INT,
  new_spread_bps INT,
  changed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fx_rate_history TO authenticated;
GRANT ALL ON public.fx_rate_history TO service_role;
ALTER TABLE public.fx_rate_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fx_rate_history_admin" ON public.fx_rate_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'finance') OR public.has_role(auth.uid(),'audit'));

CREATE TABLE public.fx_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  currency_code TEXT NOT NULL REFERENCES public.fx_currencies(code),
  balance NUMERIC(18,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, currency_code)
);
GRANT SELECT ON public.fx_wallets TO authenticated;
GRANT ALL ON public.fx_wallets TO service_role;
ALTER TABLE public.fx_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fx_wallets_own_read" ON public.fx_wallets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'finance'));

CREATE TABLE public.fx_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  from_amount NUMERIC(18,4) NOT NULL,
  to_amount NUMERIC(18,4) NOT NULL,
  mid_rate NUMERIC(18,8) NOT NULL,
  effective_rate NUMERIC(18,8) NOT NULL,
  spread_bps INT NOT NULL,
  fee_amount NUMERIC(18,4) NOT NULL DEFAULT 0,
  fee_currency TEXT NOT NULL DEFAULT 'BDT',
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fx_conversions TO authenticated;
GRANT ALL ON public.fx_conversions TO service_role;
ALTER TABLE public.fx_conversions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fx_conversions_own_read" ON public.fx_conversions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'finance'));

CREATE OR REPLACE FUNCTION public.fx_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_fx_currencies_touch BEFORE UPDATE ON public.fx_currencies
  FOR EACH ROW EXECUTE FUNCTION public.fx_touch_updated_at();
CREATE TRIGGER trg_fx_wallets_touch BEFORE UPDATE ON public.fx_wallets
  FOR EACH ROW EXECUTE FUNCTION public.fx_touch_updated_at();

CREATE OR REPLACE FUNCTION public.fx_log_rate_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.mid_rate_bdt IS DISTINCT FROM OLD.mid_rate_bdt
     OR NEW.spread_bps IS DISTINCT FROM OLD.spread_bps THEN
    INSERT INTO public.fx_rate_history(code, old_rate, new_rate, old_spread_bps, new_spread_bps, changed_by)
    VALUES (NEW.code, OLD.mid_rate_bdt, NEW.mid_rate_bdt, OLD.spread_bps, NEW.spread_bps, auth.uid());
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_fx_rate_history AFTER UPDATE ON public.fx_currencies
  FOR EACH ROW EXECUTE FUNCTION public.fx_log_rate_change();

INSERT INTO public.fx_currencies(code,name,symbol,decimals,mid_rate_bdt,spread_bps,sort_order,rate_source) VALUES
  ('BDT','Bangladeshi Taka','৳',2,1,0,0,'base'),
  ('USD','US Dollar','$',2,120.50,60,1,'manual'),
  ('EUR','Euro','€',2,131.20,60,2,'manual'),
  ('GBP','British Pound','£',2,153.40,60,3,'manual'),
  ('CNY','Chinese Yuan','¥',2,16.80,70,4,'manual'),
  ('AED','UAE Dirham','د.إ',2,32.80,70,5,'manual'),
  ('SAR','Saudi Riyal','﷼',2,32.10,70,6,'manual'),
  ('INR','Indian Rupee','₹',2,1.44,80,7,'manual'),
  ('MYR','Malaysian Ringgit','RM',2,27.30,80,8,'manual'),
  ('SGD','Singapore Dollar','S$',2,89.60,70,9,'manual');

CREATE OR REPLACE FUNCTION public.fx_convert(
  p_from TEXT,
  p_to TEXT,
  p_amount NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_from RECORD; v_to RECORD;
  v_mid NUMERIC; v_eff NUMERIC; v_spread INT;
  v_out NUMERIC; v_gross NUMERIC; v_fee NUMERIC;
  v_bal NUMERIC; v_id UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be greater than zero'; END IF;
  p_from := upper(p_from); p_to := upper(p_to);
  IF p_from = p_to THEN RAISE EXCEPTION 'Choose two different currencies'; END IF;

  SELECT * INTO v_from FROM public.fx_currencies WHERE code = p_from AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Currency % is not available', p_from; END IF;
  SELECT * INTO v_to FROM public.fx_currencies WHERE code = p_to AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Currency % is not available', p_to; END IF;

  v_mid := v_from.mid_rate_bdt / v_to.mid_rate_bdt;
  v_spread := GREATEST(v_from.spread_bps, v_to.spread_bps);
  v_eff := v_mid * (1 - v_spread::NUMERIC / 10000);
  v_gross := round(p_amount * v_mid, v_to.decimals);
  v_out := round(p_amount * v_eff, v_to.decimals);
  v_fee := v_gross - v_out;

  -- debit source
  IF p_from = 'BDT' THEN
    PERFORM public.debit_user_balance(v_uid, p_amount);
  ELSE
    SELECT balance INTO v_bal FROM public.fx_wallets WHERE user_id = v_uid AND currency_code = p_from FOR UPDATE;
    IF v_bal IS NULL OR v_bal < p_amount THEN RAISE EXCEPTION 'Insufficient % balance', p_from; END IF;
    UPDATE public.fx_wallets SET balance = balance - p_amount WHERE user_id = v_uid AND currency_code = p_from;
  END IF;

  -- credit destination
  IF p_to = 'BDT' THEN
    PERFORM public.credit_user_balance(v_uid, v_out);
  ELSE
    INSERT INTO public.fx_wallets(user_id, currency_code, balance)
    VALUES (v_uid, p_to, v_out)
    ON CONFLICT (user_id, currency_code) DO UPDATE SET balance = public.fx_wallets.balance + EXCLUDED.balance, updated_at = now();
  END IF;

  INSERT INTO public.fx_conversions(user_id, from_currency, to_currency, from_amount, to_amount, mid_rate, effective_rate, spread_bps, fee_amount, fee_currency)
  VALUES (v_uid, p_from, p_to, p_amount, v_out, v_mid, v_eff, v_spread, v_fee, p_to)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'from_amount', p_amount, 'to_amount', v_out,
    'mid_rate', v_mid, 'effective_rate', v_eff, 'spread_bps', v_spread, 'fee_amount', v_fee, 'fee_currency', p_to);
END; $$;
REVOKE ALL ON FUNCTION public.fx_convert(TEXT,TEXT,NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fx_convert(TEXT,TEXT,NUMERIC) TO authenticated;

-- ============ MERCHANT SUBSCRIPTIONS ============
CREATE TABLE public.merchant_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'BDT',
  billing_interval TEXT NOT NULL DEFAULT 'monthly',
  interval_count INT NOT NULL DEFAULT 1 CHECK (interval_count > 0),
  trial_days INT NOT NULL DEFAULT 0 CHECK (trial_days >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT merchant_plans_interval_chk CHECK (billing_interval IN ('daily','weekly','monthly','yearly'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_plans TO authenticated;
GRANT ALL ON public.merchant_plans TO service_role;
ALTER TABLE public.merchant_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "merchant_plans_public_read" ON public.merchant_plans FOR SELECT TO authenticated USING (is_active);
CREATE POLICY "merchant_plans_owner_all" ON public.merchant_plans FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid()) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid()) OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.merchant_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.merchant_plans(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  mandate_max_amount NUMERIC(14,2),
  next_charge_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_charge_at TIMESTAMPTZ,
  charges_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT merchant_subscriptions_status_chk CHECK (status IN ('trialing','active','paused','past_due','cancelled'))
);
GRANT SELECT, UPDATE ON public.merchant_subscriptions TO authenticated;
GRANT ALL ON public.merchant_subscriptions TO service_role;
ALTER TABLE public.merchant_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "merchant_subscriptions_read" ON public.merchant_subscriptions FOR SELECT TO authenticated
  USING (customer_id = auth.uid()
     OR EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid())
     OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "merchant_subscriptions_customer_update" ON public.merchant_subscriptions FOR UPDATE TO authenticated
  USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());

CREATE TABLE public.subscription_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.merchant_subscriptions(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BDT',
  status TEXT NOT NULL DEFAULT 'success',
  failure_reason TEXT,
  charged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_charges TO authenticated;
GRANT ALL ON public.subscription_charges TO service_role;
ALTER TABLE public.subscription_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscription_charges_read" ON public.subscription_charges FOR SELECT TO authenticated
  USING (customer_id = auth.uid()
     OR EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid())
     OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_merchant_plans_touch BEFORE UPDATE ON public.merchant_plans
  FOR EACH ROW EXECUTE FUNCTION public.fx_touch_updated_at();
CREATE TRIGGER trg_merchant_subscriptions_touch BEFORE UPDATE ON public.merchant_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.fx_touch_updated_at();

CREATE OR REPLACE FUNCTION public.subscribe_to_plan(p_plan_id UUID, p_mandate_max NUMERIC DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid(); v_plan RECORD; v_id UUID; v_next TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_plan FROM public.merchant_plans WHERE id = p_plan_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not available'; END IF;
  IF EXISTS (SELECT 1 FROM public.merchant_subscriptions WHERE plan_id = p_plan_id AND customer_id = v_uid AND status IN ('active','trialing','past_due')) THEN
    RAISE EXCEPTION 'You already have an active subscription to this plan';
  END IF;
  IF p_mandate_max IS NOT NULL AND p_mandate_max < v_plan.amount THEN
    RAISE EXCEPTION 'Spending cap must be at least the plan amount';
  END IF;
  v_next := now() + (v_plan.trial_days || ' days')::INTERVAL;
  INSERT INTO public.merchant_subscriptions(plan_id, merchant_id, customer_id, status, mandate_max_amount, next_charge_at)
  VALUES (p_plan_id, v_plan.merchant_id, v_uid,
          CASE WHEN v_plan.trial_days > 0 THEN 'trialing' ELSE 'active' END,
          p_mandate_max, v_next)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.subscribe_to_plan(UUID,NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.subscribe_to_plan(UUID,NUMERIC) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_subscription(p_subscription_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid(); v_sub RECORD;
BEGIN
  SELECT * INTO v_sub FROM public.merchant_subscriptions WHERE id = p_subscription_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Subscription not found'; END IF;
  IF NOT (v_sub.customer_id = v_uid
          OR EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = v_sub.merchant_id AND m.user_id = v_uid)
          OR public.has_role(v_uid,'admin')) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  UPDATE public.merchant_subscriptions
    SET status = 'cancelled', cancelled_at = now()
    WHERE id = p_subscription_id;
END; $$;
REVOKE ALL ON FUNCTION public.cancel_subscription(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_subscription(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.charge_due_subscriptions(p_limit INT DEFAULT 200)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD; v_ok INT := 0; v_fail INT := 0; v_owner UUID; v_step INTERVAL;
BEGIN
  FOR r IN
    SELECT s.*, p.amount, p.currency, p.billing_interval, p.interval_count, p.name AS plan_name
    FROM public.merchant_subscriptions s
    JOIN public.merchant_plans p ON p.id = s.plan_id
    WHERE s.status IN ('active','trialing','past_due')
      AND s.next_charge_at <= now()
      AND p.is_active
    ORDER BY s.next_charge_at
    LIMIT p_limit
  LOOP
    v_step := (r.interval_count || ' ' || CASE r.billing_interval
      WHEN 'daily' THEN 'days' WHEN 'weekly' THEN 'weeks'
      WHEN 'yearly' THEN 'years' ELSE 'months' END)::INTERVAL;

    BEGIN
      IF r.mandate_max_amount IS NOT NULL AND r.amount > r.mandate_max_amount THEN
        RAISE EXCEPTION 'Amount exceeds the approved spending cap';
      END IF;

      PERFORM public.debit_user_balance(r.customer_id, r.amount);
      SELECT user_id INTO v_owner FROM public.merchants WHERE id = r.merchant_id;
      IF v_owner IS NOT NULL THEN
        PERFORM public.credit_user_balance(v_owner, r.amount);
      END IF;

      INSERT INTO public.subscription_charges(subscription_id, merchant_id, customer_id, amount, currency, status)
      VALUES (r.id, r.merchant_id, r.customer_id, r.amount, r.currency, 'success');

      UPDATE public.merchant_subscriptions
        SET status = 'active', last_charge_at = now(),
            next_charge_at = GREATEST(now(), r.next_charge_at) + v_step,
            charges_count = charges_count + 1, failed_count = 0
        WHERE id = r.id;
      v_ok := v_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.subscription_charges(subscription_id, merchant_id, customer_id, amount, currency, status, failure_reason)
      VALUES (r.id, r.merchant_id, r.customer_id, r.amount, r.currency, 'failed', SQLERRM);
      UPDATE public.merchant_subscriptions
        SET status = CASE WHEN r.failed_count + 1 >= 3 THEN 'cancelled' ELSE 'past_due' END,
            failed_count = r.failed_count + 1,
            next_charge_at = now() + INTERVAL '1 day',
            cancelled_at = CASE WHEN r.failed_count + 1 >= 3 THEN now() ELSE NULL END
        WHERE id = r.id;
      v_fail := v_fail + 1;
    END;
  END LOOP;
  RETURN jsonb_build_object('charged', v_ok, 'failed', v_fail);
END; $$;
REVOKE ALL ON FUNCTION public.charge_due_subscriptions(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.charge_due_subscriptions(INT) TO service_role;
