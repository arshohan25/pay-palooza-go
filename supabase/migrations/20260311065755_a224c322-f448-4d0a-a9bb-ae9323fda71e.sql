
CREATE TABLE public.merchant_apply_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL DEFAULT 'all' CHECK (mode IN ('all', 'none', 'targeted')),
  allowed_roles text[] NOT NULL DEFAULT '{}',
  allowed_areas text[] NOT NULL DEFAULT '{}',
  allowed_user_ids uuid[] NOT NULL DEFAULT '{}',
  blocked_user_ids uuid[] NOT NULL DEFAULT '{}',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.merchant_apply_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage merchant apply config"
  ON public.merchant_apply_config FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can read merchant apply config"
  ON public.merchant_apply_config FOR SELECT
  TO authenticated
  USING (true);

-- Insert default config (all users can apply)
INSERT INTO public.merchant_apply_config (mode) VALUES ('all');
