
-- Gold holdings table
CREATE TABLE public.gold_holdings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  karat TEXT NOT NULL DEFAULT '22k',
  grams NUMERIC NOT NULL DEFAULT 0,
  avg_buy_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, karat)
);

ALTER TABLE public.gold_holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own gold holdings" ON public.gold_holdings FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins read all gold holdings" ON public.gold_holdings FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Stock holdings table
CREATE TABLE public.stock_holdings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 0,
  avg_buy_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, symbol)
);

ALTER TABLE public.stock_holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own stock holdings" ON public.stock_holdings FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins read all stock holdings" ON public.stock_holdings FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_gold_holdings_updated_at BEFORE UPDATE ON public.gold_holdings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_stock_holdings_updated_at BEFORE UPDATE ON public.stock_holdings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.gold_holdings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_holdings;

-- Buy Gold RPC
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
  v_new_balance NUMERIC;
  v_existing RECORD;
  v_new_grams NUMERIC;
  v_new_avg NUMERIC;
  v_ref TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM require_kyc_verified(v_user_id);

  IF p_grams IS NULL OR p_grams <= 0 THEN RAISE EXCEPTION 'Grams must be positive'; END IF;
  v_cost := ROUND(p_grams * p_price_per_gram);

  SELECT balance INTO v_balance FROM profiles WHERE user_id = v_user_id FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF v_balance < v_cost THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  v_new_balance := v_balance - v_cost;
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
  VALUES (v_user_id, 'payment', v_cost, 0, 'Gold Purchase: ' || p_grams || 'g ' || p_karat, v_ref, 'completed', v_new_balance);

  RETURN json_build_object('success', true, 'wallet_balance', v_new_balance, 'grams', v_new_grams, 'avg_price', v_new_avg);
END;
$$;

-- Sell Gold RPC
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
  v_new_balance NUMERIC;
  v_existing RECORD;
  v_new_grams NUMERIC;
  v_ref TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF p_grams IS NULL OR p_grams <= 0 THEN RAISE EXCEPTION 'Grams must be positive'; END IF;

  SELECT * INTO v_existing FROM gold_holdings WHERE user_id = v_user_id AND karat = p_karat FOR UPDATE;
  IF v_existing.id IS NULL OR v_existing.grams < p_grams THEN RAISE EXCEPTION 'Insufficient gold balance'; END IF;

  v_revenue := ROUND(p_grams * p_price_per_gram);

  SELECT balance INTO v_balance FROM profiles WHERE user_id = v_user_id FOR UPDATE;
  v_new_balance := v_balance + v_revenue;
  UPDATE profiles SET balance = v_new_balance WHERE user_id = v_user_id;

  v_new_grams := v_existing.grams - p_grams;
  IF v_new_grams <= 0 THEN
    DELETE FROM gold_holdings WHERE id = v_existing.id;
  ELSE
    UPDATE gold_holdings SET grams = v_new_grams, updated_at = now() WHERE id = v_existing.id;
  END IF;

  v_ref := 'GOLD-SELL-' || UPPER(SUBSTR(gen_random_uuid()::text, 1, 8));
  INSERT INTO transactions (user_id, type, amount, fee, description, reference, status, balance_after)
  VALUES (v_user_id, 'addmoney', v_revenue, 0, 'Gold Sale: ' || p_grams || 'g ' || p_karat, v_ref, 'completed', v_new_balance);

  RETURN json_build_object('success', true, 'wallet_balance', v_new_balance, 'remaining_grams', v_new_grams);
END;
$$;

-- Buy Stock RPC
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
  v_new_balance NUMERIC;
  v_existing RECORD;
  v_new_qty INTEGER;
  v_new_avg NUMERIC;
  v_ref TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM require_kyc_verified(v_user_id);

  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
  v_cost := ROUND(p_quantity * p_price);

  SELECT balance INTO v_balance FROM profiles WHERE user_id = v_user_id FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF v_balance < v_cost THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  v_new_balance := v_balance - v_cost;
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
  VALUES (v_user_id, 'payment', v_cost, 0, 'Stock Purchase: ' || p_quantity || 'x ' || p_symbol, v_ref, 'completed', v_new_balance);

  RETURN json_build_object('success', true, 'wallet_balance', v_new_balance, 'quantity', v_new_qty, 'avg_price', v_new_avg);
END;
$$;

-- Sell Stock RPC
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
  v_new_balance NUMERIC;
  v_existing RECORD;
  v_new_qty INTEGER;
  v_ref TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;

  SELECT * INTO v_existing FROM stock_holdings WHERE user_id = v_user_id AND symbol = p_symbol FOR UPDATE;
  IF v_existing.id IS NULL OR v_existing.quantity < p_quantity THEN RAISE EXCEPTION 'Insufficient stock balance'; END IF;

  v_revenue := ROUND(p_quantity * p_price);

  SELECT balance INTO v_balance FROM profiles WHERE user_id = v_user_id FOR UPDATE;
  v_new_balance := v_balance + v_revenue;
  UPDATE profiles SET balance = v_new_balance WHERE user_id = v_user_id;

  v_new_qty := v_existing.quantity - p_quantity;
  IF v_new_qty <= 0 THEN
    DELETE FROM stock_holdings WHERE id = v_existing.id;
  ELSE
    UPDATE stock_holdings SET quantity = v_new_qty, updated_at = now() WHERE id = v_existing.id;
  END IF;

  v_ref := 'STOCK-SELL-' || UPPER(SUBSTR(gen_random_uuid()::text, 1, 8));
  INSERT INTO transactions (user_id, type, amount, fee, description, reference, status, balance_after)
  VALUES (v_user_id, 'addmoney', v_revenue, 0, 'Stock Sale: ' || p_quantity || 'x ' || p_symbol, v_ref, 'completed', v_new_balance);

  RETURN json_build_object('success', true, 'wallet_balance', v_new_balance, 'remaining_quantity', v_new_qty);
END;
$$;
