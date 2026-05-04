DROP POLICY IF EXISTS "pin_reset_attachments_admin_select" ON storage.objects;
CREATE POLICY "pin_reset_attachments_admin_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'pin-reset-attachments'
    AND public.has_role(auth.uid(), 'admin')
  );