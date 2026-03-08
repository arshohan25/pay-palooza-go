
-- API request logs for analytics
CREATE TABLE public.merchant_api_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  api_key_id uuid NOT NULL REFERENCES public.merchant_api_keys(id) ON DELETE CASCADE,
  action text NOT NULL DEFAULT 'unknown',
  status_code integer NOT NULL DEFAULT 200,
  response_time_ms integer NOT NULL DEFAULT 0,
  ip_address text,
  user_agent text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_merchant_api_logs_merchant ON public.merchant_api_logs(merchant_id, created_at DESC);
CREATE INDEX idx_merchant_api_logs_created ON public.merchant_api_logs(created_at DESC);

ALTER TABLE public.merchant_api_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can read own API logs" ON public.merchant_api_logs
  FOR SELECT TO authenticated
  USING (
    merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- IP whitelist table
CREATE TABLE public.merchant_ip_whitelist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  ip_address text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(merchant_id, ip_address)
);

ALTER TABLE public.merchant_ip_whitelist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants manage own IP whitelist" ON public.merchant_ip_whitelist
  FOR ALL TO authenticated
  USING (
    merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- Add rate limit config to API keys
ALTER TABLE public.merchant_api_keys ADD COLUMN rate_limit_per_minute integer NOT NULL DEFAULT 30;
ALTER TABLE public.merchant_api_keys ADD COLUMN ip_whitelist_enabled boolean NOT NULL DEFAULT false;

-- Enable realtime for logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.merchant_api_logs;
