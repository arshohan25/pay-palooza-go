
-- Add is_anonymous column
ALTER TABLE public.donations ADD COLUMN is_anonymous boolean NOT NULL DEFAULT false;

-- Drop old narrow RLS policy if it exists, replace with broader one for leaderboard
DROP POLICY IF EXISTS "Users view own donations" ON public.donations;
DROP POLICY IF EXISTS "Users insert own donations" ON public.donations;
DROP POLICY IF EXISTS "Public read donations for leaderboard" ON public.donations;

-- Allow all authenticated users to read donations (for leaderboard)
CREATE POLICY "Authenticated read donations" ON public.donations FOR SELECT TO authenticated USING (true);

-- Allow users to insert their own donations
CREATE POLICY "Users insert own donations" ON public.donations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Create leaderboard RPC
CREATE OR REPLACE FUNCTION public.donation_leaderboard(p_cause text DEFAULT NULL)
RETURNS TABLE(donor_name text, total_amount numeric, donation_count bigint, cause_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    CASE WHEN bool_or(d.is_anonymous) THEN 'Anonymous' ELSE COALESCE(MAX(p.name), 'Unknown') END as donor_name,
    SUM(d.amount) as total_amount,
    COUNT(*) as donation_count,
    d.cause_name
  FROM public.donations d
  LEFT JOIN public.profiles p ON p.user_id = d.user_id
  WHERE (p_cause IS NULL OR d.cause_name = p_cause)
  GROUP BY d.user_id, d.cause_name
  ORDER BY total_amount DESC
  LIMIT 50
$$;
