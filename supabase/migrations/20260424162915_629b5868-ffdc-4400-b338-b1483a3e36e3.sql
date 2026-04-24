
-- 1a. Per-user coupon redemption tracking
CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  flow text NOT NULL,
  txn_id uuid,
  discount_amount numeric NOT NULL DEFAULT 0,
  redeemed_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS coupon_redemptions_unique_txn
  ON public.coupon_redemptions(coupon_id, user_id, txn_id)
  WHERE txn_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS coupon_redemptions_user_coupon
  ON public.coupon_redemptions(user_id, coupon_id);

ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own redemptions"
  ON public.coupon_redemptions FOR SELECT
  USING (auth.uid() = user_id);

-- 1a (cont). Per-user limit column
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS per_user_limit integer;

-- 1b. Update validate_and_apply_coupon to enforce per-user limit
CREATE OR REPLACE FUNCTION public.validate_and_apply_coupon(
  p_code text, p_cart_total numeric, p_merchant_id uuid DEFAULT NULL::uuid
) RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_coupon RECORD;
  v_discount numeric := 0;
  v_user_uses int := 0;
BEGIN
  IF p_code IS NULL OR trim(p_code) = '' THEN
    RAISE EXCEPTION 'Coupon code is required';
  END IF;

  SELECT * INTO v_coupon FROM coupons
  WHERE upper(code) = upper(trim(p_code)) AND is_active = true LIMIT 1;

  IF v_coupon.id IS NULL THEN
    RETURN json_build_object('valid', false, 'error', 'Invalid coupon code');
  END IF;

  IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < now() THEN
    RETURN json_build_object('valid', false, 'error', 'Coupon has expired');
  END IF;
  IF v_coupon.starts_at IS NOT NULL AND v_coupon.starts_at > now() THEN
    RETURN json_build_object('valid', false, 'error', 'Coupon is not yet active');
  END IF;
  IF v_coupon.usage_limit IS NOT NULL AND v_coupon.used_count >= v_coupon.usage_limit THEN
    RETURN json_build_object('valid', false, 'error', 'Coupon usage limit reached');
  END IF;

  -- Per-user limit
  IF v_coupon.per_user_limit IS NOT NULL AND auth.uid() IS NOT NULL THEN
    SELECT count(*) INTO v_user_uses
      FROM coupon_redemptions
      WHERE coupon_id = v_coupon.id AND user_id = auth.uid();
    IF v_user_uses >= v_coupon.per_user_limit THEN
      RETURN json_build_object('valid', false, 'error', 'You have already used this coupon');
    END IF;
  END IF;

  IF v_coupon.min_order_amount IS NOT NULL AND p_cart_total < v_coupon.min_order_amount THEN
    RETURN json_build_object('valid', false, 'error', 'Minimum order amount is ৳' || v_coupon.min_order_amount);
  END IF;

  IF v_coupon.merchant_id IS NOT NULL AND p_merchant_id IS NOT NULL AND v_coupon.merchant_id != p_merchant_id THEN
    RETURN json_build_object('valid', false, 'error', 'Coupon not valid for this vendor');
  END IF;

  IF v_coupon.discount_type = 'percentage' THEN
    v_discount := ROUND(p_cart_total * v_coupon.discount_value / 100, 2);
    IF v_coupon.max_discount IS NOT NULL AND v_discount > v_coupon.max_discount THEN
      v_discount := v_coupon.max_discount;
    END IF;
  ELSE
    v_discount := LEAST(v_coupon.discount_value, p_cart_total);
  END IF;

  RETURN json_build_object(
    'valid', true, 'coupon_id', v_coupon.id, 'code', v_coupon.code,
    'discount_type', v_coupon.discount_type, 'discount_value', v_coupon.discount_value,
    'discount_amount', v_discount, 'max_discount', v_coupon.max_discount
  );
END;
$$;

-- 1c. Record coupon redemption RPC
CREATE OR REPLACE FUNCTION public.record_coupon_redemption(
  p_code text, p_flow text, p_txn_id uuid, p_discount numeric
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_coupon RECORD;
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RETURN json_build_object('recorded', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_coupon FROM coupons
  WHERE upper(code) = upper(trim(p_code)) LIMIT 1;
  IF v_coupon.id IS NULL THEN
    RETURN json_build_object('recorded', false, 'error', 'Coupon not found');
  END IF;

  -- Idempotent insert
  BEGIN
    INSERT INTO coupon_redemptions (coupon_id, user_id, flow, txn_id, discount_amount)
    VALUES (v_coupon.id, v_user, p_flow, p_txn_id, COALESCE(p_discount, 0));
  EXCEPTION WHEN unique_violation THEN
    RETURN json_build_object('recorded', false, 'duplicate', true);
  END;

  -- Increment usage and auto-deactivate when limit reached
  UPDATE coupons
    SET used_count = used_count + 1,
        is_active = CASE
          WHEN usage_limit IS NOT NULL AND used_count + 1 >= usage_limit THEN false
          ELSE is_active
        END,
        updated_at = now()
    WHERE id = v_coupon.id;

  RETURN json_build_object('recorded', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_coupon_redemption(text,text,uuid,numeric) TO authenticated;

-- 1d. Gift card lifecycle
ALTER TABLE public.gift_cards
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 year');

CREATE INDEX IF NOT EXISTS gift_cards_status_expires ON public.gift_cards(status, expires_at);
CREATE INDEX IF NOT EXISTS gift_cards_code_lookup ON public.gift_cards(upper(code));

-- Redemption RPC: redeems by code, credits wallet, marks card redeemed
CREATE OR REPLACE FUNCTION public.redeem_gift_card(p_code text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_card RECORD;
  v_new_balance numeric;
  v_txn_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF p_code IS NULL OR trim(p_code) = '' THEN
    RETURN json_build_object('success', false, 'error', 'Code required');
  END IF;

  SELECT * INTO v_card FROM gift_cards
    WHERE upper(code) = upper(trim(p_code))
    FOR UPDATE;

  IF v_card.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid gift card code');
  END IF;
  IF v_card.status = 'redeemed' THEN
    RETURN json_build_object('success', false, 'error', 'Gift card already redeemed');
  END IF;
  IF v_card.status = 'expired' OR v_card.expires_at < now() THEN
    UPDATE gift_cards SET status='expired', updated_at=now() WHERE id = v_card.id AND status <> 'expired';
    RETURN json_build_object('success', false, 'error', 'Gift card has expired');
  END IF;
  IF v_card.status <> 'active' THEN
    RETURN json_build_object('success', false, 'error', 'Gift card not redeemable');
  END IF;

  -- Credit wallet
  UPDATE profiles
    SET balance = COALESCE(balance, 0) + v_card.denomination,
        updated_at = now()
    WHERE user_id = v_user
    RETURNING balance INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  INSERT INTO transactions (user_id, type, amount, fee, status, balance_after, description, reference)
    VALUES (v_user, 'addmoney', v_card.denomination, 0, 'completed', v_new_balance,
            'Gift card redeemed: ' || v_card.brand, v_card.code)
    RETURNING id INTO v_txn_id;

  UPDATE gift_cards
    SET status = 'redeemed', redeemed_by = v_user, redeemed_at = now(), updated_at = now()
    WHERE id = v_card.id;

  RETURN json_build_object(
    'success', true,
    'credited_amount', v_card.denomination,
    'brand', v_card.brand,
    'new_balance', v_new_balance,
    'txn_id', v_txn_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_gift_card(text) TO authenticated;

-- Background expiry maintenance (callable by cron or anytime)
CREATE OR REPLACE FUNCTION public.expire_stale_promotions()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE coupons SET is_active = false, updated_at = now()
    WHERE is_active = true AND expires_at IS NOT NULL AND expires_at < now();
  UPDATE gift_cards SET status = 'expired', updated_at = now()
    WHERE status = 'active' AND expires_at < now();
END;
$$;
