CREATE TABLE public.transaction_safety_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key text UNIQUE NOT NULL,
  label text NOT NULL,
  description text NOT NULL,
  is_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.transaction_safety_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage safety rules"
ON public.transaction_safety_rules
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can read safety rules"
ON public.transaction_safety_rules
FOR SELECT
TO authenticated
USING (true);

INSERT INTO public.transaction_safety_rules (rule_key, label, description, is_enabled) VALUES
  ('duplicate_guard', 'Duplicate Transaction Guard', 'Block identical txns within 30 seconds', true),
  ('velocity_control', 'Velocity Control', 'Max 20 transactions per hour per user', true),
  ('night_restriction', 'Night-time Restriction', 'High-value txns blocked 12AM-6AM', false),
  ('new_account_limit', 'New Account Limit', 'Reduced limits for accounts < 7 days old', true),
  ('cross_device_alert', 'Cross-device Alert', 'Alert on txn from new device', true);