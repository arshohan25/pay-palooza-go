
-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated merchants to upload to product-images bucket
CREATE POLICY "Merchants can upload product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM merchants WHERE user_id = auth.uid()
  )
);

-- Allow public read access
CREATE POLICY "Anyone can view product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- Allow merchants to update/delete their own uploads
CREATE POLICY "Merchants can update own product images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM merchants WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Merchants can delete own product images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM merchants WHERE user_id = auth.uid()
  )
);
