
-- Merchant API Keys table
CREATE TABLE public.merchant_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  api_key text NOT NULL UNIQUE,
  secret_key text NOT NULL,
  webhook_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.merchant_api_keys ENABLE ROW LEVEL SECURITY;

-- Merchant can read own keys
CREATE POLICY "Merchants read own API keys"
  ON public.merchant_api_keys FOR SELECT TO authenticated
  USING (
    merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
  );

-- Merchant can insert own keys
CREATE POLICY "Merchants create own API keys"
  ON public.merchant_api_keys FOR INSERT TO authenticated
  WITH CHECK (
    merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
  );

-- Merchant can update own keys
CREATE POLICY "Merchants update own API keys"
  ON public.merchant_api_keys FOR UPDATE TO authenticated
  USING (
    merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
  );

-- Merchant can delete own keys
CREATE POLICY "Merchants delete own API keys"
  ON public.merchant_api_keys FOR DELETE TO authenticated
  USING (
    merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
  );

-- Admin full access
CREATE POLICY "Admin full access merchant_api_keys"
  ON public.merchant_api_keys FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Merchant Payment Sessions table
CREATE TABLE public.merchant_payment_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  api_key_id uuid NOT NULL REFERENCES public.merchant_api_keys(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'BDT',
  reference text,
  description text,
  customer_phone text,
  payer_user_id uuid,
  status text NOT NULL DEFAULT 'pending',
  callback_url text,
  success_url text,
  cancel_url text,
  webhook_delivered boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.merchant_payment_sessions ENABLE ROW LEVEL SECURITY;

-- Merchant can read own sessions
CREATE POLICY "Merchants read own payment sessions"
  ON public.merchant_payment_sessions FOR SELECT TO authenticated
  USING (
    merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
  );

-- Admin full access
CREATE POLICY "Admin full access merchant_payment_sessions"
  ON public.merchant_payment_sessions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow anon/public read for checkout page (by session ID only)
CREATE POLICY "Public read payment session by id"
  ON public.merchant_payment_sessions FOR SELECT TO anon
  USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.merchant_payment_sessions;
