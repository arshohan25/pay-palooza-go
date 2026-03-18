
CREATE TABLE public.donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cause_name text NOT NULL,
  cause_icon text,
  amount numeric NOT NULL,
  transaction_id uuid REFERENCES public.transactions(id),
  message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own donations" ON public.donations FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own donations" ON public.donations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins manage donations" ON public.donations FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
