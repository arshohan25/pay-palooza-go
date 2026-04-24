-- =============================================================
-- Phase 3: push trigger + over-ship guard + variant uniqueness
-- =============================================================

-- Ensure pg_net is available (no-op if already installed)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============ 1. Variant constraints ============
-- Sane bounds
DO $$ BEGIN
  ALTER TABLE public.product_variants
    ADD CONSTRAINT product_variants_stock_nonneg CHECK (stock >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.product_variants
    ADD CONSTRAINT product_variants_price_adj_bounds CHECK (price_adjustment > -1000000 AND price_adjustment < 1000000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Unique SKU per product (case-insensitive, ignoring NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_variant_sku_per_product
  ON public.product_variants (product_id, lower(sku))
  WHERE sku IS NOT NULL;

-- Unique attribute combo per product
CREATE UNIQUE INDEX IF NOT EXISTS uniq_variant_attr_per_product
  ON public.product_variants (product_id, lower(variant_name), lower(variant_value));

-- ============ 2. Over-ship guard ============
CREATE OR REPLACE FUNCTION public.guard_fulfillment_overship()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ordered_qty integer;
  already_shipped integer;
BEGIN
  SELECT COALESCE((items->NEW.order_item_index->>'qty')::int, 0)
    INTO ordered_qty FROM public.orders WHERE id = NEW.order_id;

  SELECT COALESCE(SUM(qty_shipped), 0) INTO already_shipped
    FROM public.order_item_fulfillments
    WHERE order_id = NEW.order_id
      AND order_item_index = NEW.order_item_index
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF already_shipped + NEW.qty_shipped > ordered_qty THEN
    RAISE EXCEPTION 'Over-ship blocked: % already shipped of % ordered, attempted %',
      already_shipped, ordered_qty, NEW.qty_shipped
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_fulfillment_overship ON public.order_item_fulfillments;
CREATE TRIGGER trg_guard_fulfillment_overship
BEFORE INSERT OR UPDATE OF qty_shipped, order_item_index ON public.order_item_fulfillments
FOR EACH ROW EXECUTE FUNCTION public.guard_fulfillment_overship();

-- ============ 3. Notify buyer + send push on fulfillment events ============
CREATE OR REPLACE FUNCTION public.notify_fulfillment_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer uuid;
  v_order_num text;
  v_event text;
  v_title text;
  v_body text;
  v_url text;
  v_supabase_url text;
  v_service_key text;
BEGIN
  SELECT user_id, order_num INTO v_buyer, v_order_num
  FROM public.orders WHERE id = NEW.order_id;

  IF v_buyer IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    v_event := 'shipped';
    v_title := 'Order shipped 📦';
    v_body  := format('%s item(s) from #%s shipped via %s',
                      NEW.qty_shipped, COALESCE(v_order_num,''), COALESCE(NEW.courier_provider,'courier'));
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'delivered' AND COALESCE(OLD.status,'') <> 'delivered' THEN
    v_event := 'delivered';
    v_title := 'Order delivered ✅';
    v_body  := format('%s item(s) from #%s delivered', NEW.qty_shipped, COALESCE(v_order_num,''));
  ELSE
    RETURN NEW;
  END IF;

  v_url := '/orders/' || NEW.order_id::text;

  -- In-app notification
  INSERT INTO public.notifications (user_id, title, body, category, metadata)
  VALUES (v_buyer, v_title, v_body, 'order',
          jsonb_build_object('order_id', NEW.order_id, 'event', v_event,
                             'tracking', NEW.tracking_number, 'courier', NEW.courier_provider));

  -- Web push (best-effort; swallow errors so fulfillment writes never fail)
  BEGIN
    v_supabase_url := current_setting('app.supabase_url', true);
    v_service_key  := current_setting('app.service_role_key', true);

    IF v_supabase_url IS NOT NULL AND v_service_key IS NOT NULL THEN
      PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/send-push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_key
        ),
        body := jsonb_build_object(
          'user_ids', jsonb_build_array(v_buyer),
          'title',    v_title,
          'body',     v_body,
          'url',      v_url
        )
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- never block the fulfillment write
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_fulfillment ON public.order_item_fulfillments;
CREATE TRIGGER trg_notify_fulfillment
AFTER INSERT OR UPDATE ON public.order_item_fulfillments
FOR EACH ROW EXECUTE FUNCTION public.notify_fulfillment_change();