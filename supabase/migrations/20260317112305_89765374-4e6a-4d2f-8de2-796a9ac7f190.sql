
-- =============================================
-- Phase 2: Escrow & Settlement RPCs + Coupon Validation
-- =============================================

-- 1. validate_and_apply_coupon: validate coupon code and return discount
CREATE OR REPLACE FUNCTION public.validate_and_apply_coupon(
  p_code text,
  p_cart_total numeric,
  p_merchant_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_coupon RECORD;
  v_discount numeric := 0;
BEGIN
  IF p_code IS NULL OR trim(p_code) = '' THEN
    RAISE EXCEPTION 'Coupon code is required';
  END IF;

  SELECT * INTO v_coupon
  FROM coupons
  WHERE upper(code) = upper(trim(p_code))
    AND is_active = true
  LIMIT 1;

  IF v_coupon.id IS NULL THEN
    RETURN json_build_object('valid', false, 'error', 'Invalid coupon code');
  END IF;

  -- Check expiry
  IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < now() THEN
    RETURN json_build_object('valid', false, 'error', 'Coupon has expired');
  END IF;
  IF v_coupon.starts_at IS NOT NULL AND v_coupon.starts_at > now() THEN
    RETURN json_build_object('valid', false, 'error', 'Coupon is not yet active');
  END IF;

  -- Check usage limit
  IF v_coupon.usage_limit IS NOT NULL AND v_coupon.used_count >= v_coupon.usage_limit THEN
    RETURN json_build_object('valid', false, 'error', 'Coupon usage limit reached');
  END IF;

  -- Check min order amount
  IF v_coupon.min_order_amount IS NOT NULL AND p_cart_total < v_coupon.min_order_amount THEN
    RETURN json_build_object('valid', false, 'error', 'Minimum order amount is ৳' || v_coupon.min_order_amount);
  END IF;

  -- Check merchant scope
  IF v_coupon.merchant_id IS NOT NULL AND p_merchant_id IS NOT NULL AND v_coupon.merchant_id != p_merchant_id THEN
    RETURN json_build_object('valid', false, 'error', 'Coupon not valid for this vendor');
  END IF;

  -- Calculate discount
  IF v_coupon.discount_type = 'percentage' THEN
    v_discount := ROUND(p_cart_total * v_coupon.discount_value / 100, 2);
    IF v_coupon.max_discount IS NOT NULL AND v_discount > v_coupon.max_discount THEN
      v_discount := v_coupon.max_discount;
    END IF;
  ELSE
    v_discount := LEAST(v_coupon.discount_value, p_cart_total);
  END IF;

  RETURN json_build_object(
    'valid', true,
    'coupon_id', v_coupon.id,
    'code', v_coupon.code,
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value,
    'discount_amount', v_discount,
    'max_discount', v_coupon.max_discount
  );
END;
$$;

-- 2. place_shop_order: atomically debit buyer wallet + create order with escrow
CREATE OR REPLACE FUNCTION public.place_shop_order(
  p_items jsonb,           -- [{product_id, merchant_id, name, price, qty, emoji, image_url, vendor_name}]
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
  v_platform_rate numeric := 0.05; -- 5% platform fee
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Validate items
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  -- Calculate subtotal
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_price := (v_item->>'price')::numeric;
    v_item_qty := (v_item->>'qty')::int;
    IF v_item_price <= 0 OR v_item_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid item price or quantity';
    END IF;
    v_subtotal := v_subtotal + (v_item_price * v_item_qty);
  END LOOP;

  -- Apply coupon discount (capped at subtotal)
  IF p_coupon_discount < 0 THEN p_coupon_discount := 0; END IF;
  IF p_coupon_discount > v_subtotal THEN p_coupon_discount := v_subtotal; END IF;

  v_total := v_subtotal - p_coupon_discount + COALESCE(p_delivery_fee, 0);
  IF v_total <= 0 THEN RAISE EXCEPTION 'Order total must be positive'; END IF;

  -- Debit buyer wallet
  IF p_payment_method = 'wallet' THEN
    SELECT balance INTO v_balance FROM profiles WHERE user_id = v_user_id FOR UPDATE;
    IF v_balance IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
    IF v_balance < v_total THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

    v_new_balance := v_balance - v_total;
    UPDATE profiles SET balance = v_new_balance WHERE user_id = v_user_id;
  ELSE
    SELECT balance INTO v_balance FROM profiles WHERE user_id = v_user_id;
    v_new_balance := COALESCE(v_balance, 0);
  END IF;

  -- Generate order number
  v_order_num := 'ORD-' || upper(substring(md5(random()::text) FROM 1 FOR 6));

  -- Insert order with escrow_status = 'held'
  INSERT INTO orders (
    user_id, order_num, status, total, payment_method,
    shipping_name, shipping_address, shipping_city, shipping_phone,
    items, estimated_delivery, escrow_status,
    coupon_id, coupon_discount, delivery_fee,
    total_vendor_commission, total_platform_fee
  ) VALUES (
    v_user_id, v_order_num, 'processing', v_total, p_payment_method,
    p_shipping_name, p_shipping_address, p_shipping_city, p_shipping_phone,
    p_items, (now() + interval '5 days')::text, 'held',
    p_coupon_id, p_coupon_discount, COALESCE(p_delivery_fee, 0),
    0, 0 -- will update after calculating per-item
  )
  RETURNING id INTO v_order_id;

  -- Insert order_items with per-vendor commission split
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

  -- Update order totals
  UPDATE orders SET
    total_vendor_commission = v_total_vendor_commission,
    total_platform_fee = v_total_platform_fee
  WHERE id = v_order_id;

  -- Increment coupon usage
  IF p_coupon_id IS NOT NULL THEN
    UPDATE coupons SET used_count = used_count + 1, updated_at = now()
    WHERE id = p_coupon_id;
  END IF;

  -- Record buyer transaction
  IF p_payment_method = 'wallet' THEN
    INSERT INTO transactions (
      user_id, type, amount, fee, balance_after,
      description, reference, status
    ) VALUES (
      v_user_id, 'payment', v_total, 0, v_new_balance,
      'Shop order: ' || v_order_num,
      v_order_num, 'completed'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_num', v_order_num,
    'total', v_total,
    'balance', v_new_balance,
    'escrow_status', 'held',
    'platform_fee', v_total_platform_fee,
    'vendor_commission', v_total_vendor_commission
  );
END;
$$;

-- 3. release_escrow: admin releases escrow to vendors on delivery
CREATE OR REPLACE FUNCTION public.release_escrow(p_order_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin_id uuid;
  v_order RECORD;
  v_item RECORD;
  v_vendor_profile RECORD;
  v_vendor_new_balance numeric;
  v_treasury RECORD;
  v_new_treasury_balance numeric;
  v_total_released numeric := 0;
  v_total_platform numeric := 0;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL OR NOT has_role(v_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  -- Lock order
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.escrow_status != 'held' THEN
    RAISE EXCEPTION 'Escrow already % for this order', v_order.escrow_status;
  END IF;
  IF v_order.status != 'delivered' THEN
    RAISE EXCEPTION 'Order must be delivered before releasing escrow';
  END IF;

  -- Process each vendor's items
  FOR v_item IN
    SELECT merchant_id, SUM(vendor_commission) as total_commission, SUM(platform_fee) as total_fee
    FROM order_items
    WHERE order_id = p_order_id AND merchant_id IS NOT NULL
    GROUP BY merchant_id
  LOOP
    -- Credit vendor wallet via their merchant user_id
    SELECT p.user_id, p.balance INTO v_vendor_profile
    FROM profiles p
    JOIN merchants m ON m.user_id = p.user_id
    WHERE m.id = v_item.merchant_id
    FOR UPDATE OF p;

    IF v_vendor_profile.user_id IS NOT NULL THEN
      v_vendor_new_balance := v_vendor_profile.balance + v_item.total_commission;
      UPDATE profiles SET balance = v_vendor_new_balance WHERE user_id = v_vendor_profile.user_id;

      -- Record vendor earning transaction
      INSERT INTO transactions (user_id, type, amount, fee, balance_after, description, reference, status)
      VALUES (v_vendor_profile.user_id, 'receive', v_item.total_commission, 0, v_vendor_new_balance,
        'Escrow release for order ' || v_order.order_num, v_order.order_num, 'completed');

      v_total_released := v_total_released + v_item.total_commission;
    END IF;

    v_total_platform := v_total_platform + v_item.total_fee;
  END LOOP;

  -- Credit platform treasury
  IF v_total_platform > 0 THEN
    SELECT * INTO v_treasury FROM platform_treasury LIMIT 1 FOR UPDATE;
    IF v_treasury.id IS NOT NULL THEN
      v_new_treasury_balance := v_treasury.balance + v_total_platform;
      UPDATE platform_treasury SET
        balance = v_new_treasury_balance,
        total_earnings = total_earnings + v_total_platform,
        updated_at = now()
      WHERE id = v_treasury.id;

      INSERT INTO treasury_ledger (type, amount, balance_after, description, reference, actor_id)
      VALUES ('earning', v_total_platform, v_new_treasury_balance,
        'Platform fee from order ' || v_order.order_num, v_order.order_num, v_admin_id);
    END IF;
  END IF;

  -- Update order escrow status
  UPDATE orders SET
    escrow_status = 'released',
    escrow_released_at = now()
  WHERE id = p_order_id;

  -- Audit log
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (v_admin_id, 'escrow_release', 'order', p_order_id,
    jsonb_build_object(
      'order_num', v_order.order_num,
      'total_released_to_vendors', v_total_released,
      'total_platform_fee', v_total_platform
    ));

  RETURN json_build_object(
    'success', true,
    'order_num', v_order.order_num,
    'released_to_vendors', v_total_released,
    'platform_fee', v_total_platform
  );
END;
$$;

-- 4. cancel_order_escrow: refund buyer wallet on cancellation
CREATE OR REPLACE FUNCTION public.cancel_order_escrow(p_order_id uuid, p_reason text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor_id uuid;
  v_order RECORD;
  v_buyer_balance numeric;
  v_new_balance numeric;
  v_is_admin boolean;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  v_is_admin := has_role(v_actor_id, 'admin');

  -- Lock order
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;

  -- Only admin or order owner can cancel
  IF NOT v_is_admin AND v_order.user_id != v_actor_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Buyer can only cancel pending/processing orders
  IF NOT v_is_admin AND v_order.status NOT IN ('processing', 'confirmed') THEN
    RAISE EXCEPTION 'Order cannot be cancelled at this stage';
  END IF;

  IF v_order.escrow_status NOT IN ('held', NULL) THEN
    RAISE EXCEPTION 'Escrow already % for this order', COALESCE(v_order.escrow_status, 'none');
  END IF;

  -- Refund buyer wallet if paid via wallet
  IF v_order.payment_method = 'wallet' AND v_order.total > 0 AND v_order.escrow_status = 'held' THEN
    SELECT balance INTO v_buyer_balance FROM profiles WHERE user_id = v_order.user_id FOR UPDATE;
    v_new_balance := COALESCE(v_buyer_balance, 0) + v_order.total;
    UPDATE profiles SET balance = v_new_balance WHERE user_id = v_order.user_id;

    -- Record refund transaction
    INSERT INTO transactions (user_id, type, amount, fee, balance_after, description, reference, status)
    VALUES (v_order.user_id, 'addmoney', v_order.total, 0, v_new_balance,
      'Refund for cancelled order ' || v_order.order_num, v_order.order_num, 'completed');
  ELSE
    SELECT balance INTO v_new_balance FROM profiles WHERE user_id = v_order.user_id;
    v_new_balance := COALESCE(v_new_balance, 0);
  END IF;

  -- Update order
  UPDATE orders SET
    status = 'cancelled',
    escrow_status = CASE WHEN escrow_status = 'held' THEN 'refunded' ELSE escrow_status END,
    notes = COALESCE(p_reason, 'Cancelled')
  WHERE id = p_order_id;

  -- Audit
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (v_actor_id, 'order_cancel_escrow', 'order', p_order_id,
    jsonb_build_object(
      'order_num', v_order.order_num,
      'refunded', v_order.payment_method = 'wallet' AND v_order.escrow_status = 'held',
      'amount', v_order.total,
      'reason', p_reason,
      'is_admin', v_is_admin
    ));

  RETURN json_build_object(
    'success', true,
    'order_num', v_order.order_num,
    'refunded', v_order.payment_method = 'wallet' AND v_order.escrow_status = 'held',
    'new_balance', v_new_balance
  );
END;
$$;
