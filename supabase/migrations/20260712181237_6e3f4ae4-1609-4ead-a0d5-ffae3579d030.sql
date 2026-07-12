
-- 1. AGENT AVAILABILITY (locator)
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS is_available boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS shop_name text;

CREATE INDEX IF NOT EXISTS agents_available_geo_idx
  ON public.agents (is_available)
  WHERE is_available = true AND latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE OR REPLACE FUNCTION public.nearby_agents(_lat double precision, _lng double precision, _radius_km double precision DEFAULT 5)
RETURNS TABLE(
  agent_id uuid, user_id uuid, shop_name text, address text,
  latitude double precision, longitude double precision, distance_km double precision,
  avg_rating numeric, total_ratings integer, easypay_uid text, display_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.id, a.user_id,
    COALESCE(a.shop_name, a.business_name), a.address, a.latitude, a.longitude,
    (6371 * acos(cos(radians(_lat))*cos(radians(a.latitude))*cos(radians(a.longitude)-radians(_lng)) + sin(radians(_lat))*sin(radians(a.latitude)))) AS distance_km,
    a.avg_rating, a.total_ratings, p.easypay_uid, COALESCE(p.name,'Agent')
  FROM public.agents a
  LEFT JOIN public.profiles p ON p.user_id = a.user_id
  WHERE a.is_available = true AND a.latitude IS NOT NULL AND a.longitude IS NOT NULL AND a.status = 'active'
    AND (6371 * acos(cos(radians(_lat))*cos(radians(a.latitude))*cos(radians(a.longitude)-radians(_lng)) + sin(radians(_lat))*sin(radians(a.latitude)))) <= _radius_km
  ORDER BY distance_km ASC LIMIT 50;
$$;
GRANT EXECUTE ON FUNCTION public.nearby_agents(double precision, double precision, double precision) TO authenticated, anon;

-- 2. AML REPORTS
CREATE TABLE IF NOT EXISTS public.aml_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  subject_user_id uuid,
  transaction_id uuid,
  reason text NOT NULL,
  notes text,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','dismissed','actioned')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.aml_reports TO authenticated;
GRANT ALL ON public.aml_reports TO service_role;
ALTER TABLE public.aml_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents insert own AML reports" ON public.aml_reports
  FOR INSERT TO authenticated WITH CHECK (agent_id = auth.uid());
CREATE POLICY "Agents view own AML reports" ON public.aml_reports
  FOR SELECT TO authenticated
  USING (agent_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'compliance'));
CREATE POLICY "Compliance updates AML reports" ON public.aml_reports
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'compliance'));

CREATE OR REPLACE FUNCTION public.aml_report_to_fraud_alert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.fraud_alerts (user_id, transaction_id, rule_triggered, severity, status, details)
  VALUES (NEW.subject_user_id, NEW.transaction_id, 'agent_aml_report:'||NEW.reason,
    NEW.severity::fraud_severity, 'pending'::fraud_status,
    jsonb_build_object('aml_report_id', NEW.id, 'reported_by_agent', NEW.agent_id, 'notes', NEW.notes));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_aml_to_fraud ON public.aml_reports;
CREATE TRIGGER trg_aml_to_fraud AFTER INSERT ON public.aml_reports
  FOR EACH ROW EXECUTE FUNCTION public.aml_report_to_fraud_alert();

-- 3. LEADERBOARD
CREATE OR REPLACE FUNCTION public.agent_leaderboard(_territory_code text)
RETURNS TABLE(
  rank bigint, agent_user_id uuid, display_name text, masked_uid text,
  txn_count bigint, txn_volume numeric, is_me boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH agg AS (
    SELECT a.user_id,
      COUNT(t.id) AS txn_count,
      COALESCE(SUM(t.amount),0) AS txn_volume
    FROM public.agents a
    LEFT JOIN public.transactions t
      ON t.user_id = a.user_id
     AND t.status = 'completed'::txn_status
     AND t.created_at >= now() - interval '30 days'
    WHERE a.territory_code = _territory_code AND a.status = 'active'
    GROUP BY a.user_id
  ),
  ranked AS (
    SELECT
      RANK() OVER (ORDER BY txn_volume DESC, txn_count DESC) AS rank,
      agg.user_id,
      COALESCE(SPLIT_PART(p.name,' ',1),'Agent') AS display_name,
      COALESCE('••'||RIGHT(p.easypay_uid,4),'••••') AS masked_uid,
      agg.txn_count, agg.txn_volume,
      (agg.user_id = auth.uid()) AS is_me
    FROM agg LEFT JOIN public.profiles p ON p.user_id = agg.user_id
  )
  SELECT * FROM ranked ORDER BY rank ASC LIMIT 100;
$$;
GRANT EXECUTE ON FUNCTION public.agent_leaderboard(text) TO authenticated;
