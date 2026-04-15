
-- 1. Create agent_ratings table
CREATE TABLE public.agent_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  rating smallint NOT NULL,
  comment text DEFAULT '',
  transaction_id text,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX idx_agent_ratings_unique ON public.agent_ratings(agent_id, user_id, transaction_id);

ALTER TABLE public.agent_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own ratings"
ON public.agent_ratings FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can select own ratings"
ON public.agent_ratings FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can select all ratings"
ON public.agent_ratings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete ratings"
ON public.agent_ratings FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2. Add avg_rating and total_ratings to agents
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS avg_rating numeric DEFAULT 0;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS total_ratings integer DEFAULT 0;

-- 3. Trigger to auto-update agent averages
CREATE OR REPLACE FUNCTION public.update_agent_rating_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.agents
  SET avg_rating = (SELECT ROUND(AVG(r.rating)::numeric, 1) FROM public.agent_ratings r WHERE r.agent_id = COALESCE(NEW.agent_id, OLD.agent_id)),
      total_ratings = (SELECT COUNT(*) FROM public.agent_ratings r WHERE r.agent_id = COALESCE(NEW.agent_id, OLD.agent_id))
  WHERE id = COALESCE(NEW.agent_id, OLD.agent_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_update_agent_rating_stats
AFTER INSERT OR DELETE ON public.agent_ratings
FOR EACH ROW
EXECUTE FUNCTION public.update_agent_rating_stats();

-- 4. Drop and recreate get_nearby_agents with rating columns
DROP FUNCTION IF EXISTS public.get_nearby_agents(double precision, double precision, double precision);

CREATE FUNCTION public.get_nearby_agents(
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision DEFAULT 10
)
RETURNS TABLE(
  agent_id uuid,
  business_name text,
  territory_code text,
  address text,
  latitude double precision,
  longitude double precision,
  distance_km double precision,
  avg_rating numeric,
  total_ratings integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id AS agent_id,
    a.business_name,
    a.territory_code,
    a.address,
    a.latitude,
    a.longitude,
    ROUND((6371 * acos(LEAST(1.0, GREATEST(-1.0,
      cos(radians(p_lat)) * cos(radians(a.latitude)) *
      cos(radians(a.longitude) - radians(p_lng)) +
      sin(radians(p_lat)) * sin(radians(a.latitude))
    ))))::numeric, 1)::double precision AS distance_km,
    COALESCE(a.avg_rating, 0) AS avg_rating,
    COALESCE(a.total_ratings, 0) AS total_ratings
  FROM public.agents a
  WHERE a.status = 'active'
    AND a.latitude IS NOT NULL
    AND a.longitude IS NOT NULL
    AND (6371 * acos(LEAST(1.0, GREATEST(-1.0,
      cos(radians(p_lat)) * cos(radians(a.latitude)) *
      cos(radians(a.longitude) - radians(p_lng)) +
      sin(radians(p_lat)) * sin(radians(a.latitude))
    )))) <= p_radius_km
  ORDER BY distance_km ASC;
$$;
