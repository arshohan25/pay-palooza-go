ALTER TABLE public.merchant_payment_sessions
  ADD COLUMN IF NOT EXISTS webhook_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS webhook_next_retry_at timestamptz;