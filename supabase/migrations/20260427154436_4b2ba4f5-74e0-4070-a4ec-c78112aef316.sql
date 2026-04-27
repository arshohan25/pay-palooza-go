CREATE OR REPLACE FUNCTION public.get_merchant_review_eta()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_median numeric;
  v_p90 numeric;
  v_count integer;
BEGIN
  WITH recent AS (
    SELECT EXTRACT(EPOCH FROM (business_kyc_reviewed_at - created_at)) / 60.0 AS minutes
    FROM public.merchants
    WHERE business_kyc_status = 'approved'
      AND business_kyc_reviewed_at IS NOT NULL
      AND created_at > now() - interval '60 days'
      AND (business_kyc_reviewed_at - created_at) < interval '14 days'
      AND (business_kyc_reviewed_at - created_at) > interval '0 minutes'
  )
  SELECT
    percentile_cont(0.5) WITHIN GROUP (ORDER BY minutes),
    percentile_cont(0.9) WITHIN GROUP (ORDER BY minutes),
    count(*)
  INTO v_median, v_p90, v_count
  FROM recent;

  IF v_count IS NULL OR v_count < 3 THEN
    RETURN jsonb_build_object(
      'median_minutes', 1440,
      'p90_minutes', 2880,
      'sample_size', COALESCE(v_count, 0),
      'is_estimate', true,
      'computed_at', now()
    );
  END IF;

  RETURN jsonb_build_object(
    'median_minutes', round(v_median)::int,
    'p90_minutes', round(v_p90)::int,
    'sample_size', v_count,
    'is_estimate', false,
    'computed_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_merchant_review_eta() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_merchant_review_eta() TO authenticated;