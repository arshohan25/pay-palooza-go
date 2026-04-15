
-- Add location columns to agents
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS address text DEFAULT '';

-- Create index for location lookups
CREATE INDEX IF NOT EXISTS idx_agents_location ON public.agents (latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Create get_nearby_agents RPC
CREATE OR REPLACE FUNCTION public.get_nearby_agents(
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
  distance_km double precision
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
    ROUND(
      (6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(p_lat)) * cos(radians(a.latitude)) *
          cos(radians(a.longitude) - radians(p_lng)) +
          sin(radians(p_lat)) * sin(radians(a.latitude))
        ))
      ))::numeric, 1
    )::double precision AS distance_km
  FROM public.agents a
  WHERE a.status = 'active'
    AND a.latitude IS NOT NULL
    AND a.longitude IS NOT NULL
    AND (6371 * acos(
      LEAST(1.0, GREATEST(-1.0,
        cos(radians(p_lat)) * cos(radians(a.latitude)) *
        cos(radians(a.longitude) - radians(p_lng)) +
        sin(radians(p_lat)) * sin(radians(a.latitude))
      ))
    )) <= p_radius_km
  ORDER BY distance_km ASC
  LIMIT 20;
$$;
