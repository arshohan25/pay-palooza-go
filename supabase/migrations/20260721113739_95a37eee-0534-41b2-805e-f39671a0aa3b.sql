ALTER TABLE public.platform_banks ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

-- Only one bank may be default at a time
CREATE UNIQUE INDEX IF NOT EXISTS platform_banks_only_one_default
  ON public.platform_banks ((is_default))
  WHERE is_default = true;

-- Trigger: when a bank is marked default, unset any other defaults atomically
CREATE OR REPLACE FUNCTION public.platform_banks_enforce_single_default()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.platform_banks
      SET is_default = false
      WHERE id <> NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_platform_banks_single_default ON public.platform_banks;
CREATE TRIGGER trg_platform_banks_single_default
  BEFORE INSERT OR UPDATE OF is_default ON public.platform_banks
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION public.platform_banks_enforce_single_default();