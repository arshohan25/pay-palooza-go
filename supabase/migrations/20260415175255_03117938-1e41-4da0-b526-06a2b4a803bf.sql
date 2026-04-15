
-- =============================================
-- 1. UPDATE buy_gold — add 1.5% platform fee
-- =============================================
CREATE OR REPLACE FUNCTION public.buy_gold(p_grams NUMERIC, p_price_per_gram NUMERIC, p_karat TEXT DEFAULT '22k')
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_balance NUMERIC;
  v_cost NUMERIC;
  v_platform_fee NUMERIC;
  v_total_cost NUMERIC;
  v_new_balance NUMERIC;
  v_existing RECORD;
  v_new_grams NUMERIC;
  v_new_avg NUMERIC;
  v_ref TEXT;
  v_treasury RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM require_kyc_verified(v_user_id);

  IF p_grams IS NULL OR p_grams <= 0 THEN RAISE EXCEPTION 'Grams must be positive'; END IF;
  v_cost := ROUND(p_grams * p_price_per_gram);
  v_platform_fee := ROUND(v_cost * 0.015);
  v_total_cost := v_cost + v_platform_fee;

  SELECT balance INTO v_balance FROM profiles WHERE user_id = v_user_id FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF v_balance < v_total_cost THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  v_new_balance := v_balance - v_total_cost;
  UPDATE profiles SET balance = v_new_balance WHERE user_id = v_user_id;

  SELECT * INTO v_existing FROM gold_holdings WHERE user_id = v_user_id AND karat = p_karat FOR UPDATE;
  IF v_existing.id IS NOT NULL THEN
    v_new_grams := v_existing.grams + p_grams;
    v_new_avg := ROUND(((v_existing.grams * v_existing.avg_buy_price) + v_cost) / v_new_grams);
    UPDATE gold_holdings SET grams = v_new_grams, avg_buy_price = v_new_avg, updated_at = now() WHERE id = v_existing.id;
  ELSE
    v_new_grams := p_grams;
    v_new_avg := p_price_per_gram;
    INSERT INTO gold_holdings (user_id, karat, grams, avg_buy_price) VALUES (v_user_id, p_karat, p_grams, p_price_per_gram);
  END IF;

  v_ref := 'GOLD-BUY-' || UPPER(SUBSTR(gen_random_uuid()::text, 1, 8));
  INSERT INTO transactions (user_id, type, amount, fee, description, reference, status, balance_after)
  VALUES (v_user_id, 'payment', v_total_cost, v_platform_fee, 'Gold Purchase: ' || p_grams || 'g ' || p_karat, v_ref, 'completed', v_new_balance);

  -- Credit treasury
  SELECT * INTO v_treasury FROM platform_treasury LIMIT 1 FOR UPDATE;
  IF v_treasury.id IS NOT NULL THEN
    UPDATE platform_treasury SET balance = balance + v_platform_fee, total_earnings = total_earnings + v_platform_fee, updated_at = now();
    INSERT INTO treasury_ledger (type, amount, balance_after, counterparty_user_id, description, reference, actor_id)
    VALUES ('earning', v_platform_fee, v_treasury.balance + v_platform_fee, v_user_id, 'Gold buy spread 1.5%', v_ref, v_user_id);
  END IF;

  RETURN json_build_object('success', true, 'wallet_balance', v_new_balance, 'grams', v_new_grams, 'avg_price', v_new_avg, 'fee', v_platform_fee);
END;
$$;

-- =============================================
-- 2. UPDATE sell_gold — add 1.5% platform fee
-- =============================================
CREATE OR REPLACE FUNCTION public.sell_gold(p_grams NUMERIC, p_price_per_gram NUMERIC, p_karat TEXT DEFAULT '22k')
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_balance NUMERIC;
  v_revenue NUMERIC;
  v_platform_fee NUMERIC;
  v_net_revenue NUMERIC;
  v_new_balance NUMERIC;
  v_existing RECORD;
  v_new_grams NUMERIC;
  v_ref TEXT;
  v_treasury RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF p_grams IS NULL OR p_grams <= 0 THEN RAISE EXCEPTION 'Grams must be positive'; END IF;

  SELECT * INTO v_existing FROM gold_holdings WHERE user_id = v_user_id AND karat = p_karat FOR UPDATE;
  IF v_existing.id IS NULL OR v_existing.grams < p_grams THEN RAISE EXCEPTION 'Insufficient gold balance'; END IF;

  v_revenue := ROUND(p_grams * p_price_per_gram);
  v_platform_fee := ROUND(v_revenue * 0.015);
  v_net_revenue := v_revenue - v_platform_fee;

  SELECT balance INTO v_balance FROM profiles WHERE user_id = v_user_id FOR UPDATE;
  v_new_balance := v_balance + v_net_revenue;
  UPDATE profiles SET balance = v_new_balance WHERE user_id = v_user_id;

  v_new_grams := v_existing.grams - p_grams;
  IF v_new_grams <= 0 THEN
    DELETE FROM gold_holdings WHERE id = v_existing.id;
  ELSE
    UPDATE gold_holdings SET grams = v_new_grams, updated_at = now() WHERE id = v_existing.id;
  END IF;

  v_ref := 'GOLD-SELL-' || UPPER(SUBSTR(gen_random_uuid()::text, 1, 8));
  INSERT INTO transactions (user_id, type, amount, fee, description, reference, status, balance_after)
  VALUES (v_user_id, 'addmoney', v_net_revenue, v_platform_fee, 'Gold Sale: ' || p_grams || 'g ' || p_karat, v_ref, 'completed', v_new_balance);

  -- Credit treasury
  SELECT * INTO v_treasury FROM platform_treasury LIMIT 1 FOR UPDATE;
  IF v_treasury.id IS NOT NULL THEN
    UPDATE platform_treasury SET balance = balance + v_platform_fee, total_earnings = total_earnings + v_platform_fee, updated_at = now();
    INSERT INTO treasury_ledger (type, amount, balance_after, counterparty_user_id, description, reference, actor_id)
    VALUES ('earning', v_platform_fee, v_treasury.balance + v_platform_fee, v_user_id, 'Gold sell spread 1.5%', v_ref, v_user_id);
  END IF;

  RETURN json_build_object('success', true, 'wallet_balance', v_new_balance, 'remaining_grams', v_new_grams, 'fee', v_platform_fee);
END;
$$;

-- =============================================
-- 3. UPDATE buy_stock — add ৳15 brokerage
-- =============================================
CREATE OR REPLACE FUNCTION public.buy_stock(p_symbol TEXT, p_name TEXT, p_quantity INTEGER, p_price NUMERIC)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_balance NUMERIC;
  v_cost NUMERIC;
  v_brokerage NUMERIC := 15;
  v_total_cost NUMERIC;
  v_new_balance NUMERIC;
  v_existing RECORD;
  v_new_qty INTEGER;
  v_new_avg NUMERIC;
  v_ref TEXT;
  v_treasury RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM require_kyc_verified(v_user_id);

  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
  v_cost := ROUND(p_quantity * p_price);
  v_total_cost := v_cost + v_brokerage;

  SELECT balance INTO v_balance FROM profiles WHERE user_id = v_user_id FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF v_balance < v_total_cost THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  v_new_balance := v_balance - v_total_cost;
  UPDATE profiles SET balance = v_new_balance WHERE user_id = v_user_id;

  SELECT * INTO v_existing FROM stock_holdings WHERE user_id = v_user_id AND symbol = p_symbol FOR UPDATE;
  IF v_existing.id IS NOT NULL THEN
    v_new_qty := v_existing.quantity + p_quantity;
    v_new_avg := ROUND(((v_existing.quantity * v_existing.avg_buy_price) + v_cost) / v_new_qty);
    UPDATE stock_holdings SET quantity = v_new_qty, avg_buy_price = v_new_avg, name = p_name, updated_at = now() WHERE id = v_existing.id;
  ELSE
    v_new_qty := p_quantity;
    v_new_avg := p_price;
    INSERT INTO stock_holdings (user_id, symbol, name, quantity, avg_buy_price) VALUES (v_user_id, p_symbol, p_name, p_quantity, p_price);
  END IF;

  v_ref := 'STOCK-BUY-' || UPPER(SUBSTR(gen_random_uuid()::text, 1, 8));
  INSERT INTO transactions (user_id, type, amount, fee, description, reference, status, balance_after)
  VALUES (v_user_id, 'payment', v_total_cost, v_brokerage, 'Stock Purchase: ' || p_quantity || 'x ' || p_symbol, v_ref, 'completed', v_new_balance);

  -- Credit treasury
  SELECT * INTO v_treasury FROM platform_treasury LIMIT 1 FOR UPDATE;
  IF v_treasury.id IS NOT NULL THEN
    UPDATE platform_treasury SET balance = balance + v_brokerage, total_earnings = total_earnings + v_brokerage, updated_at = now();
    INSERT INTO treasury_ledger (type, amount, balance_after, counterparty_user_id, description, reference, actor_id)
    VALUES ('earning', v_brokerage, v_treasury.balance + v_brokerage, v_user_id, 'Stock brokerage fee', v_ref, v_user_id);
  END IF;

  RETURN json_build_object('success', true, 'wallet_balance', v_new_balance, 'quantity', v_new_qty, 'avg_price', v_new_avg, 'fee', v_brokerage);
END;
$$;

-- =============================================
-- 4. UPDATE sell_stock — add ৳15 brokerage
-- =============================================
CREATE OR REPLACE FUNCTION public.sell_stock(p_symbol TEXT, p_quantity INTEGER, p_price NUMERIC)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_balance NUMERIC;
  v_revenue NUMERIC;
  v_brokerage NUMERIC := 15;
  v_net_revenue NUMERIC;
  v_new_balance NUMERIC;
  v_existing RECORD;
  v_new_qty INTEGER;
  v_ref TEXT;
  v_treasury RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;

  SELECT * INTO v_existing FROM stock_holdings WHERE user_id = v_user_id AND symbol = p_symbol FOR UPDATE;
  IF v_existing.id IS NULL OR v_existing.quantity < p_quantity THEN RAISE EXCEPTION 'Insufficient stock balance'; END IF;

  v_revenue := ROUND(p_quantity * p_price);
  v_net_revenue := v_revenue - v_brokerage;
  IF v_net_revenue < 0 THEN v_net_revenue := 0; END IF;

  SELECT balance INTO v_balance FROM profiles WHERE user_id = v_user_id FOR UPDATE;
  v_new_balance := v_balance + v_net_revenue;
  UPDATE profiles SET balance = v_new_balance WHERE user_id = v_user_id;

  v_new_qty := v_existing.quantity - p_quantity;
  IF v_new_qty <= 0 THEN
    DELETE FROM stock_holdings WHERE id = v_existing.id;
  ELSE
    UPDATE stock_holdings SET quantity = v_new_qty, updated_at = now() WHERE id = v_existing.id;
  END IF;

  v_ref := 'STOCK-SELL-' || UPPER(SUBSTR(gen_random_uuid()::text, 1, 8));
  INSERT INTO transactions (user_id, type, amount, fee, description, reference, status, balance_after)
  VALUES (v_user_id, 'addmoney', v_net_revenue, v_brokerage, 'Stock Sale: ' || p_quantity || 'x ' || p_symbol, v_ref, 'completed', v_new_balance);

  -- Credit treasury
  SELECT * INTO v_treasury FROM platform_treasury LIMIT 1 FOR UPDATE;
  IF v_treasury.id IS NOT NULL THEN
    UPDATE platform_treasury SET balance = balance + v_brokerage, total_earnings = total_earnings + v_brokerage, updated_at = now();
    INSERT INTO treasury_ledger (type, amount, balance_after, counterparty_user_id, description, reference, actor_id)
    VALUES ('earning', v_brokerage, v_treasury.balance + v_brokerage, v_user_id, 'Stock brokerage fee', v_ref, v_user_id);
  END IF;

  RETURN json_build_object('success', true, 'wallet_balance', v_new_balance, 'remaining_quantity', v_new_qty, 'fee', v_brokerage);
END;
$$;
