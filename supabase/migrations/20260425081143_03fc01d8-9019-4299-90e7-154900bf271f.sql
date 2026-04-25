CREATE TABLE IF NOT EXISTS public.push_delivery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  endpoint text,
  title text NOT NULL,
  body text,
  url text,
  category text,
  status text NOT NULL,
  status_code int,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_push_logs_created_at ON public.push_delivery_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_logs_status ON public.push_delivery_logs (status);
CREATE INDEX IF NOT EXISTS idx_push_logs_category ON public.push_delivery_logs (category);
CREATE INDEX IF NOT EXISTS idx_push_logs_user ON public.push_delivery_logs (user_id);

ALTER TABLE public.push_delivery_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read push logs"
  ON public.push_delivery_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));