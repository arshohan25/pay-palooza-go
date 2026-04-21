
CREATE TABLE public.lea_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id text NOT NULL,
  phone text NOT NULL,
  target_user_id uuid,
  authority text NOT NULL,
  reference_no text NOT NULL,
  issue_date date NOT NULL,
  sections_included text[] NOT NULL DEFAULT '{}',
  generated_by uuid NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  summary jsonb DEFAULT '{}'
);

ALTER TABLE public.lea_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage LEA reports"
  ON public.lea_reports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
