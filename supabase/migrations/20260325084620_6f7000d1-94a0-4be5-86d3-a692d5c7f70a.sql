
-- Add new columns to merchant_api_keys
ALTER TABLE public.merchant_api_keys
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'live',
  ADD COLUMN IF NOT EXISTS permissions text[] NOT NULL DEFAULT '{create_session,check_status,list_sessions}',
  ADD COLUMN IF NOT EXISTS rotation_expires_at timestamptz;

-- Add check constraint for environment
ALTER TABLE public.merchant_api_keys
  ADD CONSTRAINT merchant_api_keys_environment_check CHECK (environment IN ('test', 'live'));

-- Create idempotency keys table
CREATE TABLE public.merchant_idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  session_id uuid REFERENCES public.merchant_payment_sessions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, idempotency_key)
);

-- Enable RLS
ALTER TABLE public.merchant_idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Admin-only policy
CREATE POLICY "Admins can manage idempotency keys"
  ON public.merchant_idempotency_keys
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Service role needs access from edge functions (no RLS bypass needed since edge functions use service role)
