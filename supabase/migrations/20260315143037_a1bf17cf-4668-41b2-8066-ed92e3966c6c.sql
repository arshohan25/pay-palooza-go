CREATE TABLE public.aml_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name text NOT NULL,
  description text,
  condition_type text NOT NULL,
  threshold numeric NOT NULL DEFAULT 0,
  time_window_minutes integer DEFAULT 60,
  is_active boolean NOT NULL DEFAULT true,
  action text NOT NULL DEFAULT 'flag',
  trigger_count integer NOT NULL DEFAULT 0,
  last_triggered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.aml_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage aml_rules" ON public.aml_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));