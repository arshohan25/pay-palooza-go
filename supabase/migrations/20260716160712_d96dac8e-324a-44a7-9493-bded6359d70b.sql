ALTER TABLE public.distributors
  ADD COLUMN IF NOT EXISTS nid_number text,
  ADD COLUMN IF NOT EXISTS trade_license text;