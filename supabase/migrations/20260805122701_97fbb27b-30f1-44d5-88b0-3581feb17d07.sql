ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS tips_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tip_presets integer[] NOT NULL DEFAULT ARRAY[5,10,15];

ALTER TABLE public.merchant_payment_sessions
  ADD COLUMN IF NOT EXISTS tip_amount numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.merchant_update_tips(
  p_merchant_id uuid,
  p_enabled boolean,
  p_presets integer[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.merchants m
    WHERE m.id = p_merchant_id AND m.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized for this merchant';
  END IF;

  UPDATE public.merchants
     SET tips_enabled = COALESCE(p_enabled, false),
         tip_presets = COALESCE(
           (SELECT array_agg(v ORDER BY v) FROM unnest(p_presets) AS v WHERE v > 0 AND v <= 100),
           ARRAY[5,10,15]
         ),
         updated_at = now()
   WHERE id = p_merchant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.merchant_update_tips(uuid, boolean, integer[]) TO authenticated;