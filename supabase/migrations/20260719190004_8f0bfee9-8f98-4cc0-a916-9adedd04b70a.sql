
-- Enforce positive numeric MDR at the DB layer (0 <= mdr_rate <= 100).
-- Uses NOT VALID first to avoid failing on any pre-existing bad rows, then validates.
ALTER TABLE public.merchants
  DROP CONSTRAINT IF EXISTS merchants_mdr_rate_positive;

ALTER TABLE public.merchants
  ADD CONSTRAINT merchants_mdr_rate_positive
  CHECK (mdr_rate IS NULL OR (mdr_rate >= 0 AND mdr_rate <= 100)) NOT VALID;

-- Clamp any existing out-of-range rows to 0 so we can validate the constraint.
UPDATE public.merchants SET mdr_rate = 0 WHERE mdr_rate IS NOT NULL AND (mdr_rate < 0 OR mdr_rate > 100);

ALTER TABLE public.merchants VALIDATE CONSTRAINT merchants_mdr_rate_positive;
