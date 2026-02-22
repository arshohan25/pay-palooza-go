-- Allow super_distributors to view transactions of all distributors
CREATE POLICY "Super distributors can view distributor transactions"
ON public.transactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.distributors d
    WHERE d.user_id = transactions.user_id
  )
  AND has_role(auth.uid(), 'super_distributor'::app_role)
);
