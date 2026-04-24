-- ============ PRODUCT VARIANTS (enhance existing) ============
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_product_variants_product ON public.product_variants(product_id);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active variants" ON public.product_variants;
CREATE POLICY "Public can view active variants"
ON public.product_variants FOR SELECT
USING (is_active = true);

DROP POLICY IF EXISTS "Vendors manage own variants" ON public.product_variants;
CREATE POLICY "Vendors manage own variants"
ON public.product_variants FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.merchant_products mp
    JOIN public.merchants m ON m.id = mp.merchant_id
    WHERE mp.id = product_variants.product_id AND m.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.merchant_products mp
    JOIN public.merchants m ON m.id = mp.merchant_id
    WHERE mp.id = product_variants.product_id AND m.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins manage all variants" ON public.product_variants;
CREATE POLICY "Admins manage all variants"
ON public.product_variants FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_product_variants_updated_at ON public.product_variants;
CREATE TRIGGER update_product_variants_updated_at
BEFORE UPDATE ON public.product_variants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.decrement_variant_stock(p_variant_id uuid, p_qty integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_stock integer;
BEGIN
  SELECT stock INTO current_stock FROM public.product_variants
  WHERE id = p_variant_id FOR UPDATE;
  IF current_stock IS NULL THEN
    RAISE EXCEPTION 'Variant not found';
  END IF;
  IF current_stock < p_qty THEN
    RAISE EXCEPTION 'Insufficient stock (have %, need %)', current_stock, p_qty;
  END IF;
  UPDATE public.product_variants
  SET stock = stock - p_qty, updated_at = now()
  WHERE id = p_variant_id;
END;
$$;

-- ============ ORDER ITEM FULFILLMENTS ============
CREATE TABLE IF NOT EXISTS public.order_item_fulfillments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_index integer NOT NULL,
  qty_shipped integer NOT NULL CHECK (qty_shipped > 0),
  tracking_number text,
  courier_provider text,
  status text NOT NULL DEFAULT 'shipped',
  shipped_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_oif_order ON public.order_item_fulfillments(order_id);

ALTER TABLE public.order_item_fulfillments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendor manages own order fulfillments" ON public.order_item_fulfillments;
CREATE POLICY "Vendor manages own order fulfillments"
ON public.order_item_fulfillments FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.merchants m ON m.id = o.merchant_id
    WHERE o.id = order_item_fulfillments.order_id AND m.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.merchants m ON m.id = o.merchant_id
    WHERE o.id = order_item_fulfillments.order_id AND m.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Buyer can view own order fulfillments" ON public.order_item_fulfillments;
CREATE POLICY "Buyer can view own order fulfillments"
ON public.order_item_fulfillments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_item_fulfillments.order_id AND o.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins manage all fulfillments" ON public.order_item_fulfillments;
CREATE POLICY "Admins manage all fulfillments"
ON public.order_item_fulfillments FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_order_item_fulfillments_updated_at ON public.order_item_fulfillments;
CREATE TRIGGER update_order_item_fulfillments_updated_at
BEFORE UPDATE ON public.order_item_fulfillments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.refresh_order_status_from_fulfillments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_ordered integer;
  total_shipped integer;
  total_delivered integer;
  v_order_id uuid;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);

  SELECT COALESCE(SUM((item->>'qty')::int), 0) INTO total_ordered
  FROM public.orders o, jsonb_array_elements(o.items) item
  WHERE o.id = v_order_id;

  SELECT COALESCE(SUM(qty_shipped), 0) INTO total_shipped
  FROM public.order_item_fulfillments WHERE order_id = v_order_id;

  SELECT COALESCE(SUM(qty_shipped), 0) INTO total_delivered
  FROM public.order_item_fulfillments WHERE order_id = v_order_id AND status = 'delivered';

  IF total_delivered >= total_ordered AND total_ordered > 0 THEN
    UPDATE public.orders SET status = 'delivered', updated_at = now() WHERE id = v_order_id AND status <> 'delivered';
  ELSIF total_shipped >= total_ordered AND total_ordered > 0 THEN
    UPDATE public.orders SET status = 'shipped', updated_at = now() WHERE id = v_order_id AND status NOT IN ('shipped','out_for_delivery','delivered');
  ELSIF total_shipped > 0 THEN
    UPDATE public.orders SET status = 'partially_shipped', updated_at = now() WHERE id = v_order_id AND status IN ('processing','confirmed');
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_order_status ON public.order_item_fulfillments;
CREATE TRIGGER trg_refresh_order_status
AFTER INSERT OR UPDATE OR DELETE ON public.order_item_fulfillments
FOR EACH ROW EXECUTE FUNCTION public.refresh_order_status_from_fulfillments();

-- ============ PUSH SUBSCRIPTIONS ============
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own push subs" ON public.push_subscriptions;
CREATE POLICY "Users manage own push subs"
ON public.push_subscriptions FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins manage all push subs" ON public.push_subscriptions;
CREATE POLICY "Admins manage all push subs"
ON public.push_subscriptions FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));