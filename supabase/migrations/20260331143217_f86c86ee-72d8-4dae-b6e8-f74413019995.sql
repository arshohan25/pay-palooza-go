CREATE OR REPLACE FUNCTION public.get_user_performance_stats()
 RETURNS TABLE(user_id uuid, phone text, name text, created_at timestamp with time zone, total_txns bigint, monthly_txns bigint, total_volume numeric, last_active timestamp with time zone, txn_breakdown jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        AND t2.type IN ('send', 'cashout', 'banktransfer', 'payment', 'recharge', 'paybill')
    ) t
  ) s ON true
  WHERE p.phone NOT LIKE 'staff-%'
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = p.user_id
        AND ur.role <> 'customer'::app_role
    )
$function$