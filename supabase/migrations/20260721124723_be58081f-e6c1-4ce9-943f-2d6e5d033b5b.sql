ALTER TABLE public.platform_banks
  ADD COLUMN IF NOT EXISTS show_for_customer boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_for_agent boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_for_merchant boolean NOT NULL DEFAULT true;