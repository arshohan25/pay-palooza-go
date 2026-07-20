
-- Ownership helper (idempotent)
CREATE OR REPLACE FUNCTION public.is_merchant_owner_of(_merchant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.merchants m
    WHERE m.id = _merchant_id AND m.user_id = auth.uid()
  );
$$;

-- ============ merchant_broadcasts ============
CREATE TABLE IF NOT EXISTS public.merchant_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  audience text NOT NULL CHECK (audience IN ('all','recent_30d','inactive_60d','gold_silver')),
  channel text NOT NULL DEFAULT 'inapp' CHECK (channel IN ('inapp','inapp_sms')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sending','sent','failed')),
  recipients_count int NOT NULL DEFAULT 0,
  delivered_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_broadcasts TO authenticated;
GRANT ALL ON public.merchant_broadcasts TO service_role;

ALTER TABLE public.merchant_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "merchant owner reads own broadcasts"
  ON public.merchant_broadcasts FOR SELECT TO authenticated
  USING (public.is_merchant_owner_of(merchant_id));

CREATE POLICY "merchant owner inserts own broadcasts"
  ON public.merchant_broadcasts FOR INSERT TO authenticated
  WITH CHECK (public.is_merchant_owner_of(merchant_id) AND created_by = auth.uid());

CREATE POLICY "merchant owner updates own broadcasts"
  ON public.merchant_broadcasts FOR UPDATE TO authenticated
  USING (public.is_merchant_owner_of(merchant_id));

CREATE INDEX IF NOT EXISTS idx_merchant_broadcasts_merchant
  ON public.merchant_broadcasts(merchant_id, created_at DESC);

-- ============ merchant_broadcast_recipients ============
CREATE TABLE IF NOT EXISTS public.merchant_broadcast_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id uuid NOT NULL REFERENCES public.merchant_broadcasts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'delivered' CHECK (status IN ('delivered','failed','suppressed')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(broadcast_id, user_id)
);

GRANT SELECT, INSERT ON public.merchant_broadcast_recipients TO authenticated;
GRANT ALL ON public.merchant_broadcast_recipients TO service_role;

ALTER TABLE public.merchant_broadcast_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recipient sees own row"
  ON public.merchant_broadcast_recipients FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.merchant_broadcasts b
      WHERE b.id = broadcast_id AND public.is_merchant_owner_of(b.merchant_id)
    )
  );

CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_broadcast
  ON public.merchant_broadcast_recipients(broadcast_id);

-- ============ merchant_review_nudges ============
CREATE TABLE IF NOT EXISTS public.merchant_review_nudges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.merchant_review_nudges TO authenticated;
GRANT ALL ON public.merchant_review_nudges TO service_role;

ALTER TABLE public.merchant_review_nudges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review nudge visible to owner or user"
  ON public.merchant_review_nudges FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_merchant_owner_of(merchant_id));

-- ============ RPC: today snapshot ============
CREATE OR REPLACE FUNCTION public.get_merchant_today_snapshot(p_merchant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today_start timestamptz := date_trunc('day', now());
  v_yday_start  timestamptz := date_trunc('day', now()) - interval '1 day';
  v_today_rev numeric := 0;
  v_today_orders int := 0;
  v_yday_rev numeric := 0;
  v_top_product text;
  v_new_customers int := 0;
  v_returning int := 0;
  v_avg numeric := 0;
BEGIN
  IF NOT public.is_merchant_owner_of(p_merchant_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COALESCE(SUM(total_price),0), COUNT(DISTINCT order_id)
    INTO v_today_rev, v_today_orders
  FROM public.order_items
  WHERE merchant_id = p_merchant_id AND created_at >= v_today_start;

  SELECT COALESCE(SUM(total_price),0) INTO v_yday_rev
  FROM public.order_items
  WHERE merchant_id = p_merchant_id
    AND created_at >= v_yday_start AND created_at < v_today_start;

  SELECT product_name INTO v_top_product
  FROM public.order_items
  WHERE merchant_id = p_merchant_id AND created_at >= v_today_start
  GROUP BY product_name
  ORDER BY SUM(total_price) DESC
  LIMIT 1;

  IF v_today_orders > 0 THEN
    v_avg := v_today_rev / v_today_orders;
  END IF;

  -- new vs returning today (buyer_user_id first seen today = new)
  WITH today_buyers AS (
    SELECT DISTINCT o.buyer_user_id
    FROM public.orders o
    WHERE o.merchant_id = p_merchant_id
      AND o.created_at >= v_today_start
      AND o.buyer_user_id IS NOT NULL
  )
  SELECT
    COUNT(*) FILTER (
      WHERE NOT EXISTS (
        SELECT 1 FROM public.orders o2
        WHERE o2.merchant_id = p_merchant_id
          AND o2.buyer_user_id = tb.buyer_user_id
          AND o2.created_at < v_today_start
      )
    ),
    COUNT(*) FILTER (
      WHERE EXISTS (
        SELECT 1 FROM public.orders o2
        WHERE o2.merchant_id = p_merchant_id
          AND o2.buyer_user_id = tb.buyer_user_id
          AND o2.created_at < v_today_start
      )
    )
  INTO v_new_customers, v_returning
  FROM today_buyers tb;

  RETURN jsonb_build_object(
    'today_revenue', v_today_rev,
    'today_orders', v_today_orders,
    'yesterday_revenue', v_yday_rev,
    'avg_ticket', v_avg,
    'top_product', v_top_product,
    'new_customers', COALESCE(v_new_customers,0),
    'returning_customers', COALESCE(v_returning,0),
    'delta_pct', CASE WHEN v_yday_rev > 0 THEN ((v_today_rev - v_yday_rev) / v_yday_rev * 100) WHEN v_today_rev > 0 THEN 100 ELSE 0 END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_merchant_today_snapshot(uuid) TO authenticated;

-- ============ RPC: audience preview count ============
CREATE OR REPLACE FUNCTION public.get_merchant_broadcast_audience_count(p_merchant_id uuid, p_audience text)
RETURNS int
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int := 0;
BEGIN
  IF NOT public.is_merchant_owner_of(p_merchant_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_audience = 'all' THEN
    SELECT COUNT(DISTINCT buyer_user_id) INTO v_count
    FROM public.orders WHERE merchant_id = p_merchant_id AND buyer_user_id IS NOT NULL;
  ELSIF p_audience = 'recent_30d' THEN
    SELECT COUNT(DISTINCT buyer_user_id) INTO v_count
    FROM public.orders
    WHERE merchant_id = p_merchant_id AND buyer_user_id IS NOT NULL
      AND created_at >= now() - interval '30 days';
  ELSIF p_audience = 'inactive_60d' THEN
    SELECT COUNT(*) INTO v_count FROM (
      SELECT buyer_user_id, MAX(created_at) AS last_order
      FROM public.orders
      WHERE merchant_id = p_merchant_id AND buyer_user_id IS NOT NULL
      GROUP BY buyer_user_id
      HAVING MAX(created_at) < now() - interval '60 days'
    ) x;
  ELSIF p_audience = 'gold_silver' THEN
    SELECT COUNT(DISTINCT o.buyer_user_id) INTO v_count
    FROM public.orders o
    JOIN public.user_loyalty ul ON ul.user_id = o.buyer_user_id
    WHERE o.merchant_id = p_merchant_id AND o.buyer_user_id IS NOT NULL
      AND ul.tier_name IN ('Gold','Silver','Signature','Premier');
  END IF;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_merchant_broadcast_audience_count(uuid, text) TO authenticated;
