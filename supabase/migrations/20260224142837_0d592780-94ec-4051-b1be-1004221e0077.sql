
-- Create recharge_api_configs table
CREATE TABLE public.recharge_api_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator text NOT NULL UNIQUE,
  display_name text NOT NULL,
  api_base_url text,
  config jsonb NOT NULL DEFAULT '{}',
  is_enabled boolean NOT NULL DEFAULT false,
  last_tested timestamptz,
  test_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recharge_api_configs ENABLE ROW LEVEL SECURITY;

-- Admin-only full access
CREATE POLICY "Admins can manage recharge api configs"
  ON public.recharge_api_configs
  FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_recharge_api_configs_updated_at
  BEFORE UPDATE ON public.recharge_api_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.recharge_api_configs;

-- Seed the 5 operators
INSERT INTO public.recharge_api_configs (operator, display_name) VALUES
  ('Grameenphone', 'Grameenphone (GP)'),
  ('Robi', 'Robi'),
  ('Banglalink', 'Banglalink'),
  ('Teletalk', 'Teletalk'),
  ('Airtel', 'Airtel');
