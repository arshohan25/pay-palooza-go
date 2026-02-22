
-- Allow distributors to view transactions of their linked agents
CREATE POLICY "Distributors can view agent transactions"
ON public.transactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.agents a
    JOIN public.distributors d ON d.id = a.distributor_id
    WHERE a.user_id = transactions.user_id
      AND d.user_id = auth.uid()
  )
);
