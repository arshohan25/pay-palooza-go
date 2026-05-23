CREATE OR REPLACE FUNCTION sell_gold(
  p_grams         NUMERIC,
  p_price_per_gram NUMERIC,
  p_karat          TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_revenue NUMERIC := ROUND(p_grams * p_price_per_gram, 2);
  v_fee     NUMERIC := ROUND(v_revenue * 0.015, 2);
  v_net     NUMERIC := v_revenue - v_fee;
  v_holding gold_holdings;
BEGIN
  IF p_grams <= 0 THEN RAISE EXCEPTION 'Grams must be positive'; END IF;
  SELECT * INTO v_holding FROM gold_holdings
    WHERE user_id = v_uid AND karat = p_karat FOR UPDATE;
  IF NOT FOUND OR v_holding.grams < p_grams THEN
    RAISE EXCEPTION 'Insufficient gold balance';
  END IF;
  IF v_holding.grams = p_grams THEN
    DELETE FROM gold_holdings WHERE user_id = v_uid AND karat = p_karat;
  ELSE
    UPDATE gold_holdings
      SET grams = grams - p_grams, last_price_update = now()
      WHERE user_id = v_uid AND karat = p_karat;
  END IF;
  UPDATE profiles SET balance = balance + v_net, updated_at = now()
    WHERE user_id = v_uid;
  RETURN jsonb_build_object('success', true, 'received', v_net, 'fee', v_fee);
END;
$$;