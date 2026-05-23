DROP FUNCTION IF EXISTS buy_stock(TEXT, TEXT, INT, NUMERIC);

CREATE OR REPLACE FUNCTION buy_stock(
  p_symbol   TEXT,
  p_name     TEXT,
  p_quantity INT,
  p_price    NUMERIC
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_subtotal NUMERIC := ROUND(p_quantity * p_price, 2);
  v_brok     NUMERIC := 15;
  v_total    NUMERIC := v_subtotal + v_brok;
  v_holding  stock_holdings;
  v_new_avg  NUMERIC;
BEGIN
  IF p_quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
  UPDATE profiles
    SET balance    = balance - v_total,
        updated_at = now()
    WHERE user_id = v_uid AND balance >= v_total;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  SELECT * INTO v_holding FROM stock_holdings
    WHERE user_id = v_uid AND symbol = p_symbol FOR UPDATE;
  IF FOUND THEN
    v_new_avg := ROUND(
      (v_holding.quantity * v_holding.avg_buy_price + p_quantity * p_price)
      / (v_holding.quantity + p_quantity), 2
    );
    UPDATE stock_holdings
      SET quantity          = quantity + p_quantity,
          avg_buy_price     = v_new_avg,
          current_price     = p_price,
          last_price_update = now()
      WHERE user_id = v_uid AND symbol = p_symbol;
  ELSE
    INSERT INTO stock_holdings(user_id, symbol, name, quantity, avg_buy_price, current_price, last_price_update)
      VALUES(v_uid, p_symbol, p_name, p_quantity, p_price, p_price, now());
  END IF;
  RETURN jsonb_build_object('success', true, 'paid', v_total, 'brokerage', v_brok);
END;
$$;