CREATE POLICY "Payers can update their payment session"
ON public.merchant_payment_sessions FOR UPDATE TO authenticated
USING (payer_user_id IS NULL OR payer_user_id = auth.uid())
WITH CHECK (payer_user_id IS NULL OR payer_user_id = auth.uid());