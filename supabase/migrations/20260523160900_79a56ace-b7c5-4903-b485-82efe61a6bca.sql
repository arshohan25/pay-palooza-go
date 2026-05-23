CREATE OR REPLACE FUNCTION buy_gold(
  p_grams         NUMERIC,
  p_price_per_gram NUMERIC,
  p_karat          TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_cost    NUMERIC := ROUND(p_grams * p_price_per_gram, 2);
  v_fee     NUMERIC := ROUND(v_cost * 0.015, 2);
  v_total   NUMERIC := v_cost + v_fee;
  v_holding gold_holdings;
  v_new_avg NUMERIC;
BEGIN
  IF p_grams <= 0 THEN RAISE EXCEPTION 'Grams must be positive'; END IF;
  IF p_karat NOT IN ('22k','24k') THEN RAISE EXCEPTION 'Invalid karat'; END IF;
  UPDATE profiles
    SET balance    = balance - v_total,
        updated_at = now()
    WHERE user_id = v_uid AND balance >= v_total;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  SELECT * INTO v_holding FROM gold_holdings
    WHERE user_id = v_uid AND karat = p_karat FOR UPDATE;
  IF FOUND THEN
    v_new_avg := ROUND(
      (v_holding.grams * v_holding.avg_buy_price + p_grams * p_price_per_gram)
      / (v_holding.grams + p_grams), 2
    );
    UPDATE gold_holdings
      SET grams             = grams + p_grams,
          avg_buy_price     = v_new_avg,
          last_price_update = now()
      WHERE user_id = v_uid AND karat = p_karat;
  ELSE
    INSERT INTO gold_holdings(user_id, karat, grams, avg_buy_price, last_price_update)
      VALUES(v_uid, p_karat, p_grams, p_price_per_gram, now());
  END IF;
  RETURN jsonb_build_object('success', true, 'paid', v_total, 'fee', v_fee, 'grams', p_grams);
END;
$$;