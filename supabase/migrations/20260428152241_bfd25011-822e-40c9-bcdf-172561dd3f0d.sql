
CREATE TABLE public.merchant_pin_reset_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  note TEXT,
  source TEXT NOT NULL DEFAULT 'merchant-login',
  ip TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mprr_status_created ON public.merchant_pin_reset_requests (status, created_at DESC);
CREATE INDEX idx_mprr_phone ON public.merchant_pin_reset_requests (phone);

ALTER TABLE public.merchant_pin_reset_requests ENABLE ROW LEVEL SECURITY;

-- Only admins can view/manage. Public inserts go through the edge function (service role).
CREATE POLICY "Admins view pin reset requests"
ON public.merchant_pin_reset_requests
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update pin reset requests"
ON public.merchant_pin_reset_requests
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
