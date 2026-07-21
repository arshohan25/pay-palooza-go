
ALTER TABLE public.platform_banks ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Public read of bank-logos objects (bucket itself is private)
CREATE POLICY "Public can view bank logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'bank-logos');

CREATE POLICY "Admins can upload bank logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'bank-logos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update bank logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'bank-logos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete bank logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'bank-logos' AND public.has_role(auth.uid(), 'admin'));
