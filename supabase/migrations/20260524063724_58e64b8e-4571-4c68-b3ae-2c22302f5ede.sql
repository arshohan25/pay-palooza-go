CREATE OR REPLACE FUNCTION sell_stock(
  p_symbol   TEXT,
  p_quantity INT,
  p_price    NUMERIC
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_revenue NUMERIC := ROUND(p_quantity * p_price, 2);
  v_brok    NUMERIC := 15;
  v_net     NUMERIC := v_revenue - v_brok;
  v_holding stock_holdings;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive';
  END IF;

  SELECT * INTO v_holding
    FROM stock_holdings
    WHERE user_id = v_uid AND symbol = p_symbol
    FOR UPDATE;

  IF NOT FOUND OR v_holding.quantity < p_quantity THEN
    RAISE EXCEPTION 'Insufficient shares';
  END IF;

  IF v_holding.quantity = p_quantity THEN
    DELETE FROM stock_holdings
      WHERE user_id = v_uid AND symbol = p_symbol;
  ELSE
    UPDATE stock_holdings
      SET quantity          = quantity - p_quantity,
          current_price     = p_price,
          last_price_update = now()
      WHERE user_id = v_uid AND symbol = p_symbol;
  END IF;

  UPDATE profiles
    SET balance    = balance + v_net,
        updated_at = now()
    WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'success',    true,
    'received',   v_net,
    'brokerage',  v_brok
  );
END;
$$;