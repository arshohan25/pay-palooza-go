
DROP POLICY IF EXISTS "Merchants can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Merchants can update own product images" ON storage.objects;
DROP POLICY IF EXISTS "Merchants can delete own product images" ON storage.objects;

CREATE POLICY "Merchants can upload own product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM public.merchants m
    WHERE m.user_id = auth.uid()
      AND m.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Merchants can update own product images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM public.merchants m
    WHERE m.user_id = auth.uid()
      AND m.id::text = (storage.foldername(name))[1]
  )
)
WITH CHECK (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM public.merchants m
    WHERE m.user_id = auth.uid()
      AND m.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Merchants can delete own product images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM public.merchants m
    WHERE m.user_id = auth.uid()
      AND m.id::text = (storage.foldername(name))[1]
  )
);
