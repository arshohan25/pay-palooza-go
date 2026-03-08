
CREATE TABLE public.merchant_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  business_name text NOT NULL,
  category text NOT NULL DEFAULT 'retail',
  trade_license text,
  bank_name text,
  bank_account_number text,
  bank_routing text,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.merchant_applications ENABLE ROW LEVEL SECURITY;

-- Validation trigger for status
CREATE OR REPLACE FUNCTION public.validate_merchant_application_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status: must be pending, approved, or rejected';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_merchant_app_status
  BEFORE INSERT OR UPDATE ON public.merchant_applications
  FOR EACH ROW EXECUTE FUNCTION public.validate_merchant_application_status();

-- RLS policies
CREATE POLICY "Users view own applications" ON public.merchant_applications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users create applications" ON public.merchant_applications
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins manage applications" ON public.merchant_applications
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.merchant_applications;
