CREATE TABLE public.deposit_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  method text NOT NULL,
  label text NOT NULL,
  account_number text NOT NULL,
  account_name text,
  bank_name text,
  instructions text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deposit_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage deposit accounts"
  ON public.deposit_accounts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Users can read active deposit accounts"
  ON public.deposit_accounts FOR SELECT TO authenticated
  USING (is_active = true);