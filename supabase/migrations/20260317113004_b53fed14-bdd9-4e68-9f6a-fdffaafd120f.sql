-- Create storage bucket for review images
INSERT INTO storage.buckets (id, name, public) VALUES ('review-images', 'review-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload review images
CREATE POLICY "Users can upload review images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'review-images' AND auth.uid()::text = (storage.foldername(name))[2]);

-- Public read access for review images
CREATE POLICY "Review images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'review-images');

-- Users can delete their own review images
CREATE POLICY "Users can delete own review images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'review-images' AND auth.uid()::text = (storage.foldername(name))[2]);
