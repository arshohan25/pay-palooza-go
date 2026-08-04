-- 0. Ownership helper
CREATE OR REPLACE FUNCTION public.is_merchant_owner(_merchant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.merchants m
    WHERE m.id = _merchant_id AND m.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.merchant_staff ms
    WHERE ms.merchant_id = _merchant_id
      AND ms.user_id = auth.uid()
      AND COALESCE(ms.is_active, true) = true
  );
$$;

-- 1. Per-product low stock threshold
ALTER TABLE public.merchant_products
  ADD COLUMN IF NOT EXISTS low_stock_threshold integer NOT NULL DEFAULT 5;

-- 2. Alert log (one open alert per product/level)
CREATE TABLE IF NOT EXISTS public.product_stock_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.merchant_products(id) ON DELETE CASCADE,
  level text NOT NULL CHECK (level IN ('low','out')),
  stock_at_alert integer NOT NULL DEFAULT 0,
  threshold_at_alert integer NOT NULL DEFAULT 0,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS product_stock_alerts_open_uniq
  ON public.product_stock_alerts (product_id, level)
  WHERE resolved_at IS NULL;

GRANT SELECT ON public.product_stock_alerts TO authenticated;
GRANT ALL ON public.product_stock_alerts TO service_role;
ALTER TABLE public.product_stock_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants view own stock alerts" ON public.product_stock_alerts;
CREATE POLICY "Merchants view own stock alerts"
ON public.product_stock_alerts FOR SELECT TO authenticated
USING (public.is_merchant_owner(merchant_id) OR public.has_role(auth.uid(), 'admin'));

-- 3. Merchant delivery zones
CREATE TABLE IF NOT EXISTS public.merchant_delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  zone_name text NOT NULL,
  districts text[] NOT NULL DEFAULT '{}',
  delivery_fee numeric NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  free_shipping_threshold numeric CHECK (free_shipping_threshold IS NULL OR free_shipping_threshold >= 0),
  estimated_days text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS merchant_delivery_zones_merchant_idx
  ON public.merchant_delivery_zones (merchant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_delivery_zones TO authenticated;
GRANT ALL ON public.merchant_delivery_zones TO service_role;
ALTER TABLE public.merchant_delivery_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants manage own delivery zones" ON public.merchant_delivery_zones;
CREATE POLICY "Merchants manage own delivery zones"
ON public.merchant_delivery_zones FOR ALL TO authenticated
USING (public.is_merchant_owner(merchant_id) OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.is_merchant_owner(merchant_id) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Shoppers read active delivery zones" ON public.merchant_delivery_zones;
CREATE POLICY "Shoppers read active delivery zones"
ON public.merchant_delivery_zones FOR SELECT TO authenticated
USING (is_active = true);

DROP TRIGGER IF EXISTS trg_mdz_updated_at ON public.merchant_delivery_zones;
CREATE TRIGGER trg_mdz_updated_at
BEFORE UPDATE ON public.merchant_delivery_zones
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Low stock report for the merchant dashboard
CREATE OR REPLACE FUNCTION public.get_merchant_stock_alerts(p_merchant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_out jsonb;
  v_low jsonb;
BEGIN
  IF NOT (public.is_merchant_owner(p_merchant_id) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'name'), '[]'::jsonb) INTO v_out
  FROM (
    SELECT jsonb_build_object('id', p.id, 'name', p.name, 'stock', p.stock,
                              'threshold', p.low_stock_threshold, 'emoji', p.emoji) AS x
    FROM public.merchant_products p
    WHERE p.merchant_id = p_merchant_id AND p.is_active AND p.stock <= 0
  ) s;

  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'name'), '[]'::jsonb) INTO v_low
  FROM (
    SELECT jsonb_build_object('id', p.id, 'name', p.name, 'stock', p.stock,
                              'threshold', p.low_stock_threshold, 'emoji', p.emoji) AS x
    FROM public.merchant_products p
    WHERE p.merchant_id = p_merchant_id AND p.is_active
      AND p.stock > 0 AND p.stock <= p.low_stock_threshold
  ) s;

  RETURN jsonb_build_object(
    'out_of_stock', v_out,
    'low_stock', v_low,
    'out_count', jsonb_array_length(v_out),
    'low_count', jsonb_array_length(v_low)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_merchant_stock_alerts(uuid) TO authenticated;

-- 5. Shipping fee resolver for checkout
CREATE OR REPLACE FUNCTION public.get_merchant_shipping_fee(
  p_merchant_id uuid,
  p_district text,
  p_subtotal numeric
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  z public.merchant_delivery_zones;
BEGIN
  SELECT * INTO z
  FROM public.merchant_delivery_zones
  WHERE merchant_id = p_merchant_id
    AND is_active
    AND (
      p_district IS NOT NULL AND EXISTS (
        SELECT 1 FROM unnest(districts) d
        WHERE lower(trim(d)) = lower(trim(p_district))
      )
    )
  ORDER BY delivery_fee ASC
  LIMIT 1;

  IF z.id IS NULL THEN
    RETURN jsonb_build_object('matched', false, 'fee', NULL);
  END IF;

  RETURN jsonb_build_object(
    'matched', true,
    'zone_id', z.id,
    'zone_name', z.zone_name,
    'estimated_days', z.estimated_days,
    'free_shipping_threshold', z.free_shipping_threshold,
    'fee', CASE
      WHEN z.free_shipping_threshold IS NOT NULL
       AND COALESCE(p_subtotal, 0) >= z.free_shipping_threshold THEN 0
      ELSE z.delivery_fee
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_merchant_shipping_fee(uuid, text, numeric) TO authenticated, anon;