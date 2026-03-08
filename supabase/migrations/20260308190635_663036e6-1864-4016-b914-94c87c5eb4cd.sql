CREATE TABLE public.merchant_api_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid REFERENCES merchants(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  webhook_url text,
  reason text,
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_api_request_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status: must be pending, approved, or rejected';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_api_request_status
  BEFORE INSERT OR UPDATE ON public.merchant_api_requests
  FOR EACH ROW EXECUTE FUNCTION public.validate_api_request_status();

ALTER TABLE public.merchant_api_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants view own requests" ON merchant_api_requests FOR SELECT TO authenticated
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

CREATE POLICY "Merchants create requests" ON merchant_api_requests FOR INSERT TO authenticated
  WITH CHECK (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

CREATE POLICY "Admins manage api requests" ON merchant_api_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));