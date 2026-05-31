-- Drop overloaded RPCs so PostgREST resolves a single signature each
DROP FUNCTION IF EXISTS public.buy_gold(numeric, numeric, text);
DROP FUNCTION IF EXISTS public.buy_gold(numeric, numeric, text, text);
DROP FUNCTION IF EXISTS public.sell_gold(numeric, numeric, text);
DROP FUNCTION IF EXISTS public.sell_gold(numeric, numeric, text, text);
DROP FUNCTION IF EXISTS public.buy_stock(text, integer, numeric, text);
DROP FUNCTION IF EXISTS public.buy_stock(text, text, integer, numeric, text);
DROP FUNCTION IF EXISTS public.sell_stock(text, integer, numeric, text);

-- Recreate buy_gold (single signature)
CREATE OR REPLACE FUNCTION public.buy_gold(p_grams numeric, p_price_per_gram numeric, p_karat text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_subtot  NUMERIC := ROUND(p_grams * p_price_per_gram, 2);
  v_fee     NUMERIC := ROUND(v_subtot * 0.015, 2);
  v_total   NUMERIC := v_subtot + v_fee;
  v_balance NUMERIC;
  v_hold    gold_holdings;
  v_new_avg NUMERIC;
BEGIN
  IF p_grams <= 0 THEN RAISE EXCEPTION 'Grams must be positive'; END IF;
  IF p_karat NOT IN ('22k','24k') THEN RAISE EXCEPTION 'Invalid karat'; END IF;

  SELECT balance INTO v_balance FROM profiles WHERE user_id = v_uid FOR UPDATE;
  IF v_balance IS NULL OR v_balance < v_total THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  UPDATE profiles SET balance = balance - v_total, updated_at = now() WHERE user_id = v_uid;

  SELECT * INTO v_hold FROM gold_holdings WHERE user_id = v_uid AND karat = p_karat FOR UPDATE;
  IF FOUND THEN
    v_new_avg := ROUND(((v_hold.grams * v_hold.avg_buy_price) + (p_grams * p_price_per_gram)) / (v_hold.grams + p_grams), 2);
    UPDATE gold_holdings
      SET grams = grams + p_grams,
          avg_buy_price = v_new_avg,
          current_price = p_price_per_gram,
          last_price_update = now()
      WHERE user_id = v_uid AND karat = p_karat;
  ELSE
    INSERT INTO gold_holdings(user_id, karat, grams, avg_buy_price, current_price, last_price_update)
      VALUES (v_uid, p_karat, p_grams, p_price_per_gram, p_price_per_gram, now());
  END IF;

  RETURN jsonb_build_object('success', true, 'paid', v_total, 'fee', v_fee);
END;
$$;

CREATE OR REPLACE FUNCTION public.sell_gold(p_grams numeric, p_price_per_gram numeric, p_karat text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_rev    NUMERIC := ROUND(p_grams * p_price_per_gram, 2);
  v_fee    NUMERIC := ROUND(v_rev * 0.015, 2);
  v_net    NUMERIC := v_rev - v_fee;
  v_hold   gold_holdings;
BEGIN
  IF p_grams <= 0 THEN RAISE EXCEPTION 'Grams must be positive'; END IF;
  SELECT * INTO v_hold FROM gold_holdings WHERE user_id = v_uid AND karat = p_karat FOR UPDATE;
  IF NOT FOUND OR v_hold.grams < p_grams THEN RAISE EXCEPTION 'Insufficient holdings'; END IF;

  IF v_hold.grams = p_grams THEN
    DELETE FROM gold_holdings WHERE user_id = v_uid AND karat = p_karat;
  ELSE
    UPDATE gold_holdings
      SET grams = grams - p_grams, current_price = p_price_per_gram, last_price_update = now()
      WHERE user_id = v_uid AND karat = p_karat;
  END IF;

  UPDATE profiles SET balance = balance + v_net, updated_at = now() WHERE user_id = v_uid;
  RETURN jsonb_build_object('success', true, 'received', v_net, 'fee', v_fee);
END;
$$;

CREATE OR REPLACE FUNCTION public.buy_stock(p_symbol text, p_name text, p_quantity integer, p_price numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_sub     NUMERIC := ROUND(p_quantity * p_price, 2);
  v_brok    NUMERIC := 15;
  v_total   NUMERIC := v_sub + v_brok;
  v_balance NUMERIC;
  v_hold    stock_holdings;
  v_new_avg NUMERIC;
BEGIN
  IF p_quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
  SELECT balance INTO v_balance FROM profiles WHERE user_id = v_uid FOR UPDATE;
  IF v_balance IS NULL OR v_balance < v_total THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  UPDATE profiles SET balance = balance - v_total, updated_at = now() WHERE user_id = v_uid;

  SELECT * INTO v_hold FROM stock_holdings WHERE user_id = v_uid AND symbol = p_symbol FOR UPDATE;
  IF FOUND THEN
    v_new_avg := ROUND(((v_hold.quantity * v_hold.avg_buy_price) + (p_quantity * p_price)) / (v_hold.quantity + p_quantity), 2);
    UPDATE stock_holdings
      SET quantity = quantity + p_quantity,
          avg_buy_price = v_new_avg,
          current_price = p_price,
          last_price_update = now()
      WHERE user_id = v_uid AND symbol = p_symbol;
  ELSE
    INSERT INTO stock_holdings(user_id, symbol, name, quantity, avg_buy_price, current_price, last_price_update)
      VALUES (v_uid, p_symbol, p_name, p_quantity, p_price, p_price, now());
  END IF;

  RETURN jsonb_build_object('success', true, 'paid', v_total, 'brokerage', v_brok);
END;
$$;

CREATE OR REPLACE FUNCTION public.sell_stock(p_symbol text, p_quantity integer, p_price numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_rev     NUMERIC := ROUND(p_quantity * p_price, 2);
  v_brok    NUMERIC := 15;
  v_net     NUMERIC := v_rev - v_brok;
  v_hold    stock_holdings;
BEGIN
  IF p_quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
  SELECT * INTO v_hold FROM stock_holdings WHERE user_id = v_uid AND symbol = p_symbol FOR UPDATE;
  IF NOT FOUND OR v_hold.quantity < p_quantity THEN RAISE EXCEPTION 'Insufficient holdings'; END IF;

  IF v_hold.quantity = p_quantity THEN
    DELETE FROM stock_holdings WHERE user_id = v_uid AND symbol = p_symbol;
  ELSE
    UPDATE stock_holdings
      SET quantity = quantity - p_quantity, current_price = p_price, last_price_update = now()
      WHERE user_id = v_uid AND symbol = p_symbol;
  END IF;

  UPDATE profiles SET balance = balance + v_net, updated_at = now() WHERE user_id = v_uid;
  RETURN jsonb_build_object('success', true, 'received', v_net, 'brokerage', v_brok);
END;
$$;

-- Add 90-day lock-in for DPS-linked goals on top of the existing 60-day goal lock
CREATE OR REPLACE FUNCTION public.cancel_goal(p_goal_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_goal      savings_goals;
  v_lock_end  TIMESTAMPTZ;
  v_days_left INT;
  v_has_dps   BOOLEAN;
  v_dps_lock  TIMESTAMPTZ;
  v_dps_days  INT;
BEGIN
  SELECT * INTO v_goal FROM savings_goals WHERE id = p_goal_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Goal not found'; END IF;
  IF v_goal.status NOT IN ('active','completed') THEN
    RAISE EXCEPTION 'Goal cannot be cancelled (status: %)', v_goal.status;
  END IF;

  -- 60-day lock on any goal
  v_lock_end  := v_goal.created_at + INTERVAL '60 days';
  v_days_left := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_lock_end - now())) / 86400))::INT;
  IF now() < v_lock_end THEN
    RAISE EXCEPTION 'Goal is locked for % more days', v_days_left;
  END IF;

  -- 90-day lock when there is/was a DPS plan attached
  SELECT EXISTS(SELECT 1 FROM savings_auto_save WHERE goal_id = p_goal_id) INTO v_has_dps;
  IF v_has_dps THEN
    SELECT MIN(created_at) + INTERVAL '90 days' INTO v_dps_lock FROM savings_auto_save WHERE goal_id = p_goal_id;
    v_dps_days := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_dps_lock - now())) / 86400))::INT;
    IF now() < v_dps_lock THEN
      RAISE EXCEPTION 'DPS plan is locked for % more days', v_dps_days;
    END IF;
  END IF;

  IF v_goal.saved_amount > 0 THEN
    UPDATE profiles SET balance = balance + v_goal.saved_amount, updated_at = now() WHERE user_id = v_uid;
  END IF;
  UPDATE savings_goals
    SET status = 'cancelled', withdrawn_amount = v_goal.saved_amount, withdrawn_at = now(), updated_at = now()
    WHERE id = p_goal_id;

  RETURN jsonb_build_object('success', true, 'refund', v_goal.saved_amount);
END;
$$;