
CREATE OR REPLACE FUNCTION public.get_user_performance_stats()
RETURNS TABLE (
  user_id UUID,
  phone TEXT,
  name TEXT,
  created_at TIMESTAMPTZ,
  total_txns BIGINT,
  monthly_txns BIGINT,
  total_volume NUMERIC,
  last_active TIMESTAMPTZ,
  txn_breakdown JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.phone,
    p.name,
    p.created_at,
    COALESCE(s.total_txns, 0) AS total_txns,
    COALESCE(s.monthly_txns, 0) AS monthly_txns,
    COALESCE(s.total_volume, 0) AS total_volume,
    s.last_active,
    COALESCE(s.txn_breakdown, '{}'::jsonb) AS txn_breakdown
  FROM profiles p
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::bigint AS total_txns,
      COUNT(*) FILTER (WHERE t.created_at >= date_trunc('month', now()))::bigint AS monthly_txns,
      COALESCE(SUM(t.amount), 0)::numeric AS total_volume,
      MAX(t.created_at) AS last_active,
      jsonb_object_agg(
        t.type::text,
        t.cnt
      ) AS txn_breakdown
    FROM (
      SELECT DISTINCT ON (t2.type) t2.type, t2.amount, t2.created_at,
        COUNT(*) OVER (PARTITION BY t2.type) AS cnt
      FROM transactions t2
      WHERE t2.user_id = p.user_id
    ) t
  ) s ON true
$$;
