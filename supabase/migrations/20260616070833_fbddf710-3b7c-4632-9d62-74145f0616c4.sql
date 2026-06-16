ALTER TABLE public.easypay_uid_access_alerts
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_note text;

CREATE POLICY "admins update uid alerts"
  ON public.easypay_uid_access_alerts
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'compliance'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'compliance'::app_role));

GRANT UPDATE ON public.easypay_uid_access_alerts TO authenticated;