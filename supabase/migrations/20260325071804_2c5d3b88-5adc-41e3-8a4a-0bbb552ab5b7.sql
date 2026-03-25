CREATE TABLE public.mfs_incoming_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  txn_id TEXT NOT NULL,
  sender_number TEXT,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'unmatched',
  matched_request_id UUID REFERENCES public.fund_requests(id),
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mfs_incoming_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage incoming MFS"
  ON public.mfs_incoming_payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE UNIQUE INDEX idx_mfs_incoming_txn ON public.mfs_incoming_payments(provider, txn_id);