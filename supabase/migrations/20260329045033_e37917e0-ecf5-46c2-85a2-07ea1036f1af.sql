-- 1. Create checkout_payment_methods table
CREATE TABLE IF NOT EXISTS checkout_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  icon TEXT DEFAULT 'wallet',
  description TEXT,
  is_enabled BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE checkout_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read checkout_payment_methods"
  ON checkout_payment_methods FOR SELECT USING (true);

CREATE POLICY "Admin can manage checkout_payment_methods"
  ON checkout_payment_methods FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed default methods
INSERT INTO checkout_payment_methods (key, label, icon, description, sort_order) VALUES
  ('wallet', 'EasyPay Wallet', 'wallet', 'Pay from your wallet balance', 0),
  ('cod', 'Cash on Delivery', 'truck', 'Pay when you receive your order', 1),
  ('bkash', 'bKash', 'smartphone', 'Pay via bKash mobile banking', 2),
  ('nagad', 'Nagad', 'smartphone', 'Pay via Nagad mobile banking', 3),
  ('card', 'Credit/Debit Card', 'credit-card', 'Pay with Visa or Mastercard', 4)
ON CONFLICT (key) DO NOTHING;

-- 2. Update place_shop_order to handle COD
CREATE OR REPLACE FUNCTION public.place_shop_order(
  p_items jsonb,
  p_shipping_name text,
  p_shipping_address text,
  p_shipping_city text,
  p_shipping_phone text,
  p_delivery_fee numeric DEFAULT 0,
  p_coupon_id uuid DEFAULT NULL,
  p_coupon_discount numeric DEFAULT 0,
  p_payment_method text DEFAULT 'wallet'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_balance numeric;
  v_subtotal numeric := 0;
  v_total numeric;
  v_new_balance numeric;
  v_order_id uuid;
  v_order_num text;
  v_item jsonb;
  v_item_price numeric;
  v_item_qty int;
  v_item_total numeric;
  v_platform_fee numeric;
  v_vendor_commission numeric;
  v_total_platform_fee numeric := 0;
  v_total_vendor_commission numeric := 0;
  v_platform_rate numeric := 0.05;
  v_escrow_status text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_price := (v_item->>'price')::numeric;
    v_item_qty := (v_item->>'qty')::int;
    IF v_item_price <= 0 OR v_item_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid item price or quantity';
    END IF;
    v_subtotal := v_subtotal + (v_item_price * v_item_qty);
  END LOOP;

  IF p_coupon_discount < 0 THEN p_coupon_discount := 0; END IF;
  IF p_coupon_discount > v_subtotal THEN p_coupon_discount := v_subtotal; END IF;

  v_total := v_subtotal - p_coupon_discount + COALESCE(p_delivery_fee, 0);
  IF v_total <= 0 THEN RAISE EXCEPTION 'Order total must be positive'; END IF;

  IF p_payment_method = 'cod' THEN
    v_escrow_status := 'pending_cod';
    SELECT balance INTO v_balance FROM profiles WHERE user_id = v_user_id;
    v_new_balance := COALESCE(v_balance, 0);
  ELSIF p_payment_method = 'wallet' THEN
    v_escrow_status := 'held';
    SELECT balance INTO v_balance FROM profiles WHERE user_id = v_user_id FOR UPDATE;
    IF v_balance IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
    IF v_balance < v_total THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
    v_new_balance := v_balance - v_total;
    UPDATE profiles SET balance = v_new_balance WHERE user_id = v_user_id;
  ELSE
    v_escrow_status := 'held';
    SELECT balance INTO v_balance FROM profiles WHERE user_id = v_user_id;
    v_new_balance := COALESCE(v_balance, 0);
  END IF;

  v_order_num := 'ORD-' || upper(substring(md5(random()::text) FROM 1 FOR 6));

  INSERT INTO orders (
    user_id, order_num, status, total, payment_method,
    shipping_name, shipping_address, shipping_city, shipping_phone,
    items, estimated_delivery, escrow_status,
    coupon_id, coupon_discount, delivery_fee,
    total_vendor_commission, total_platform_fee
  ) VALUES (
    v_user_id, v_order_num, 'processing', v_total, p_payment_method,
    p_shipping_name, p_shipping_address, p_shipping_city, p_shipping_phone,
    p_items, (now() + interval '5 days')::text, v_escrow_status,
    p_coupon_id, p_coupon_discount, COALESCE(p_delivery_fee, 0),
    0, 0
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_price := (v_item->>'price')::numeric;
    v_item_qty := (v_item->>'qty')::int;
    v_item_total := v_item_price * v_item_qty;
    v_platform_fee := ROUND(v_item_total * v_platform_rate, 2);
    v_vendor_commission := v_item_total - v_platform_fee;
    v_total_platform_fee := v_total_platform_fee + v_platform_fee;
    v_total_vendor_commission := v_total_vendor_commission + v_vendor_commission;

    INSERT INTO order_items (
      order_id, product_id, merchant_id, product_name,
      unit_price, quantity, subtotal,
      vendor_commission, platform_fee
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      CASE WHEN v_item->>'merchant_id' IS NOT NULL AND v_item->>'merchant_id' != ''
           THEN (v_item->>'merchant_id')::uuid ELSE NULL END,
      v_item->>'name',
      v_item_price, v_item_qty, v_item_total,
      v_vendor_commission, v_platform_fee
    );
  END LOOP;

  UPDATE orders SET
    total_vendor_commission = v_total_vendor_commission,
    total_platform_fee = v_total_platform_fee
  WHERE id = v_order_id;

  IF p_payment_method = 'wallet' THEN
    INSERT INTO transactions (user_id, type, amount, fee, balance_after, description, reference, status)
    VALUES (v_user_id, 'payment', v_total, 0, v_new_balance,
      'Shop order ' || v_order_num, v_order_num, 'completed');
  END IF;

  IF p_coupon_id IS NOT NULL THEN
    UPDATE coupons SET used_count = used_count + 1 WHERE id = p_coupon_id;
  END IF;

  INSERT INTO notifications (user_id, title, body, category, metadata)
  VALUES (v_user_id,
    '🛒 Order Placed: ' || v_order_num,
    'Your order of ৳' || v_total || ' has been placed successfully.' ||
    CASE WHEN p_payment_method = 'cod' THEN ' Pay on delivery.' ELSE '' END,
    'order',
    jsonb_build_object('order_id', v_order_id, 'order_num', v_order_num, 'total', v_total, 'payment_method', p_payment_method));

  RETURN json_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_num', v_order_num,
    'total', v_total,
    'balance', v_new_balance,
    'payment_method', p_payment_method
  );
END;
$$;