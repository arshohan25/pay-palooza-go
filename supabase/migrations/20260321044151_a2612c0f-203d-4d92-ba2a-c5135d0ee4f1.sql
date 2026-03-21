
-- Add merchant_id, merchant_code, note to payment_links
ALTER TABLE public.payment_links ADD COLUMN IF NOT EXISTS merchant_id UUID REFERENCES public.merchants(id);
ALTER TABLE public.payment_links ADD COLUMN IF NOT EXISTS merchant_code TEXT;
ALTER TABLE public.payment_links ADD COLUMN IF NOT EXISTS note TEXT;

-- Add payment_link_id to merchant_payment_sessions
ALTER TABLE public.merchant_payment_sessions ADD COLUMN IF NOT EXISTS payment_link_id UUID REFERENCES public.payment_links(id);

-- RLS: Merchants can manage their own payment links
CREATE POLICY "Merchants can view own links"
ON public.payment_links FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR has_role(auth.uid(), 'admin')
);

CREATE POLICY "Merchants can create own links"
ON public.payment_links FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Merchants can update own links"
ON public.payment_links FOR UPDATE TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "Merchants can delete own links"
ON public.payment_links FOR DELETE TO authenticated
USING (created_by = auth.uid());

-- Drop the old admin-only policy since we now have granular ones
DROP POLICY IF EXISTS "Admins manage payment_links" ON public.payment_links;
