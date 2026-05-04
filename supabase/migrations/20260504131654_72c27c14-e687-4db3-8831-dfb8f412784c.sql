ALTER TABLE public.merchant_pin_reset_messages
  ADD COLUMN IF NOT EXISTS read_by_admin_at timestamptz;

UPDATE public.merchant_pin_reset_messages
  SET read_by_admin_at = created_at
  WHERE read_by_admin = true AND read_by_admin_at IS NULL;