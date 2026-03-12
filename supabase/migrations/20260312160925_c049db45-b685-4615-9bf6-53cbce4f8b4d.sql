ALTER TABLE public.savings_auto_save
  ADD COLUMN duration text,
  ADD COLUMN ends_at timestamptz,
  ADD COLUMN settled boolean NOT NULL DEFAULT false;