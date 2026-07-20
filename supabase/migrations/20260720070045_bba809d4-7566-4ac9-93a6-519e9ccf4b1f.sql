
-- 1. Merchant-level settings
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS service_charge_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS service_charge_rate numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_charge_absorb boolean NOT NULL DEFAULT false;

ALTER TABLE public.merchants
  DROP CONSTRAINT IF EXISTS merchants_service_charge_rate_check;
ALTER TABLE public.merchants
  ADD CONSTRAINT merchants_service_charge_rate_check
  CHECK (service_charge_rate >= 0 AND service_charge_rate <= 20);

-- 2. Per-order audit column (populated by checkout / settlement code later)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS service_charge numeric(12,2) NOT NULL DEFAULT 0;

-- 3. Settlement audit column so payouts can show/deduct it
ALTER TABLE public.settlements
  ADD COLUMN IF NOT EXISTS service_charge_amount numeric(12,2) NOT NULL DEFAULT 0;

-- 4. Secure RPC so a merchant can update ONLY their own service-charge settings
CREATE OR REPLACE FUNCTION public.merchant_update_service_charge(
  p_enabled boolean,
  p_rate numeric,
  p_absorb boolean
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_rate IS NULL OR p_rate < 0 OR p_rate > 20 THEN
    RAISE EXCEPTION 'invalid_rate';
  END IF;

  UPDATE public.merchants
     SET service_charge_enabled = COALESCE(p_enabled, false),
         service_charge_rate    = p_rate,
         service_charge_absorb  = COALESCE(p_absorb, false),
         updated_at             = now()
   WHERE user_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'merchant_not_found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.merchant_update_service_charge(boolean, numeric, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchant_update_service_charge(boolean, numeric, boolean) TO authenticated;
