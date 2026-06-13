
-- Composite index to speed up per-user transaction history (covers ORDER BY created_at DESC)
CREATE INDEX IF NOT EXISTS idx_transactions_user_created
  ON public.transactions (user_id, created_at DESC);

-- Drop now-redundant single-column index (user_id alone is fully covered by the composite)
DROP INDEX IF EXISTS public.idx_transactions_user_id;

-- Partial index optimized for the webhook-retry sweep on merchant_payment_sessions
-- Matches: webhook_delivered=false AND webhook_attempts<N AND webhook_next_retry_at<=now() AND status IN (...)
CREATE INDEX IF NOT EXISTS idx_mps_webhook_retry_due
  ON public.merchant_payment_sessions (webhook_next_retry_at, status, webhook_attempts)
  WHERE webhook_delivered = false AND webhook_next_retry_at IS NOT NULL;
