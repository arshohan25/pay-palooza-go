
CREATE TABLE IF NOT EXISTS public.payment_link_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES public.payment_links(id) ON DELETE CASCADE,
  payer_id UUID NOT NULL,
  payee_id UUID NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'BDT',
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'succeeded',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_link_payments_link_idx ON public.payment_link_payments(link_id);
CREATE INDEX IF NOT EXISTS payment_link_payments_payer_idx ON public.payment_link_payments(payer_id);
CREATE INDEX IF NOT EXISTS payment_link_payments_payee_idx ON public.payment_link_payments(payee_id);

GRANT SELECT ON public.payment_link_payments TO authenticated;
GRANT ALL ON public.payment_link_payments TO service_role;

ALTER TABLE public.payment_link_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Payers can view own payments"
  ON public.payment_link_payments FOR SELECT TO authenticated
  USING (payer_id = auth.uid());

CREATE POLICY "Payees can view payments to them"
  ON public.payment_link_payments FOR SELECT TO authenticated
  USING (payee_id = auth.uid());

CREATE POLICY "Admins can view all payments"
  ON public.payment_link_payments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
