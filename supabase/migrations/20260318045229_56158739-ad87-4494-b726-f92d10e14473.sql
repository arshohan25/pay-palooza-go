
-- Return/Refund requests table
CREATE TABLE public.return_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation trigger for status
CREATE OR REPLACE FUNCTION public.validate_return_request_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'approved', 'rejected', 'completed') THEN
    RAISE EXCEPTION 'Invalid status: must be pending, approved, rejected, or completed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_return_request_status
  BEFORE INSERT OR UPDATE ON public.return_requests
  FOR EACH ROW EXECUTE FUNCTION public.validate_return_request_status();

-- RLS
ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own return requests
CREATE POLICY "Users can view own return requests"
  ON public.return_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can create return requests for their own orders
CREATE POLICY "Users can create return requests"
  ON public.return_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admins can view all return requests
CREATE POLICY "Admins can view all return requests"
  ON public.return_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update return requests
CREATE POLICY "Admins can update return requests"
  ON public.return_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Add tracking_number and courier_provider_id to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS courier_provider_id UUID REFERENCES public.courier_providers(id);
