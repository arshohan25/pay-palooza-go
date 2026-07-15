CREATE POLICY "Admins can upload kyc docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'kyc-documents' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update kyc docs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'kyc-documents' AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (bucket_id = 'kyc-documents' AND public.has_role(auth.uid(), 'admin'::public.app_role));