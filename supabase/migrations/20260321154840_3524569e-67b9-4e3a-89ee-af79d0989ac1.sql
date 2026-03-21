
CREATE OR REPLACE FUNCTION public.get_merchant_customers(p_merchant_id UUID)
RETURNS TABLE(
  customer_user_id UUID,
  customer_name TEXT,
  customer_phone TEXT,
  total_spent NUMERIC,
  order_count BIGINT,
  last_order_at TIMESTAMPTZ,
  tier TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller UUID;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM merchants WHERE id = p_merchant_id AND user_id = v_caller
  ) AND NOT has_role(v_caller, 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: you do not own this merchant';
  END IF;

  RETURN QUERY
  SELECT
    o.user_id AS customer_user_id,
    MAX(o.shipping_name)::TEXT AS customer_name,
    MAX(o.shipping_phone)::TEXT AS customer_phone,
    COALESCE(SUM(o.total), 0) AS total_spent,
    COUNT(*)::BIGINT AS order_count,
    MAX(o.created_at) AS last_order_at,
    CASE
      WHEN COALESCE(SUM(o.total), 0) >= 10000 THEN 'Gold'
      WHEN COALESCE(SUM(o.total), 0) >= 5000 THEN 'Silver'
      WHEN COALESCE(SUM(o.total), 0) >= 1000 THEN 'Bronze'
      ELSE 'New'
    END::TEXT AS tier
  FROM orders o
  WHERE o.merchant_id = p_merchant_id
    AND o.status NOT IN ('cancelled')
    AND o.user_id IS NOT NULL
  GROUP BY o.user_id
  ORDER BY COALESCE(SUM(o.total), 0) DESC;
END;
$$;
