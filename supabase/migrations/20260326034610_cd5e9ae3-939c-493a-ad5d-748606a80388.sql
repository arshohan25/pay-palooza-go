DROP POLICY "Payers can update their payment session" ON public.merchant_payment_sessions;

CREATE POLICY "Payers can update own assigned session" ON public.merchant_payment_sessions
FOR UPDATE TO authenticated
USING (payer_user_id = auth.uid())
WITH CHECK (payer_user_id = auth.uid());