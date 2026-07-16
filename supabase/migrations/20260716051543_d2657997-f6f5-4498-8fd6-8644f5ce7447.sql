
-- Add Division > District > Upazila > Union Parishad/Powrashava fields to merchant_applications
ALTER TABLE public.merchant_applications
  ADD COLUMN IF NOT EXISTS division text,
  ADD COLUMN IF NOT EXISTS district_name text,
  ADD COLUMN IF NOT EXISTS upazila text,
  ADD COLUMN IF NOT EXISTS union_parishad text,
  ADD COLUMN IF NOT EXISTS area_type text CHECK (area_type IN ('union','powrashava','city_corporation'));

-- Same for agents, distributors, super_distributors if tables/cols exist (safe no-ops otherwise)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='agents') THEN
    EXECUTE 'ALTER TABLE public.agents
      ADD COLUMN IF NOT EXISTS union_parishad text,
      ADD COLUMN IF NOT EXISTS area_type text';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='distributors') THEN
    EXECUTE 'ALTER TABLE public.distributors
      ADD COLUMN IF NOT EXISTS union_parishad text,
      ADD COLUMN IF NOT EXISTS area_type text';
  END IF;
END $$;

-- Optional lookup table for known unions/powrashavas so the picker can be pre-populated over time.
CREATE TABLE IF NOT EXISTS public.unions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  division text NOT NULL,
  district text NOT NULL,
  upazila text NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'union' CHECK (type IN ('union','powrashava','city_corporation')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(division, district, upazila, name)
);

GRANT SELECT ON public.unions TO anon, authenticated;
GRANT ALL ON public.unions TO service_role;

ALTER TABLE public.unions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='unions' AND policyname='Anyone can read active unions') THEN
    CREATE POLICY "Anyone can read active unions" ON public.unions FOR SELECT USING (is_active = true);
  END IF;
END $$;
