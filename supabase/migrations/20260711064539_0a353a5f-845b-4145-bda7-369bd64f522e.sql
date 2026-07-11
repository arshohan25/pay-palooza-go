
CREATE TABLE IF NOT EXISTS public.payment_link_refund_idempotency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  payment_id uuid NOT NULL REFERENCES public.payment_link_payments(id) ON DELETE CASCADE,
  requested_amount numeric,
  status text NOT NULL DEFAULT 'pending', -- pending | succeeded | failed
  response jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (actor_id, idempotency_key)
);

GRANT ALL ON public.payment_link_refund_idempotency TO service_role;

ALTER TABLE public.payment_link_refund_idempotency ENABLE ROW LEVEL SECURITY;

-- Only service role touches this table; no user-facing policies needed.
CREATE POLICY "service role only" ON public.payment_link_refund_idempotency
  FOR ALL TO service_role USING (true) WITH CHECK (true);
