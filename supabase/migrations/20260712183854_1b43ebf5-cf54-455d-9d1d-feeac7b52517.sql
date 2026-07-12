
CREATE POLICY "Users upload own avatar in product-images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = 'avatars'
  AND split_part(split_part(name, '/', 2), '.', 1) = auth.uid()::text
);

CREATE POLICY "Users update own avatar in product-images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = 'avatars'
  AND split_part(split_part(name, '/', 2), '.', 1) = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = 'avatars'
  AND split_part(split_part(name, '/', 2), '.', 1) = auth.uid()::text
);

CREATE POLICY "Users delete own avatar in product-images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = 'avatars'
  AND split_part(split_part(name, '/', 2), '.', 1) = auth.uid()::text
);
