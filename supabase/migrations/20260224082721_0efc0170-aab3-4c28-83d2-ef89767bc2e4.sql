
-- Payment gateway configurations (credentials stored per gateway)
CREATE TABLE public.payment_gateways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE, -- e.g. 'bkash', 'nagad', 'rocket'
  display_name text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb, -- encrypted credentials
  is_enabled boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage payment gateways"
  ON public.payment_gateways FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Global feature toggles
CREATE TABLE public.global_feature_toggles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  is_enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.global_feature_toggles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage global toggles"
  ON public.global_feature_toggles FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can read global toggles"
  ON public.global_feature_toggles FOR SELECT
  USING (true);

-- Seed default gateways
INSERT INTO public.payment_gateways (provider, display_name, sort_order) VALUES
  ('bkash', 'bKash', 1),
  ('nagad', 'Nagad', 2),
  ('rocket', 'Rocket', 3),
  ('upay', 'Upay', 4),
  ('tap', 'Tap', 5),
  ('mcash', 'mCash', 6);

-- Seed default feature toggles
INSERT INTO public.global_feature_toggles (feature_key, label, description, sort_order) VALUES
  ('send_money', 'Send Money', 'Allow users to send money', 1),
  ('cash_out', 'Cash Out', 'Allow cash out from agents', 2),
  ('cash_in', 'Cash In', 'Allow cash in via agents', 3),
  ('add_money', 'Add Money', 'Allow adding money to wallet', 4),
  ('payment', 'Payment', 'Allow merchant payments', 5),
  ('mobile_recharge', 'Mobile Recharge', 'Allow mobile recharge', 6),
  ('pay_bill', 'Pay Bill', 'Allow bill payments', 7),
  ('bank_transfer', 'Bank Transfer', 'Allow bank transfers', 8),
  ('qr_scan', 'QR Scan', 'Allow QR scanning', 9),
  ('savings', 'Savings', 'Allow savings features', 10),
  ('shop', 'Shop', 'Allow in-app shopping', 11);

-- Triggers for updated_at
CREATE TRIGGER update_payment_gateways_updated_at
  BEFORE UPDATE ON public.payment_gateways
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_global_feature_toggles_updated_at
  BEFORE UPDATE ON public.global_feature_toggles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.global_feature_toggles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_gateways;
