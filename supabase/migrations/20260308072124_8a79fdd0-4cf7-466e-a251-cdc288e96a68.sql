-- Add media columns to promo_banners
ALTER TABLE public.promo_banners ADD COLUMN IF NOT EXISTS media_url text;
ALTER TABLE public.promo_banners ADD COLUMN IF NOT EXISTS media_type text;

-- Create banner-media storage bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('banner-media', 'banner-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to banner media
CREATE POLICY "Public can read banner media"
ON storage.objects FOR SELECT
USING (bucket_id = 'banner-media');

-- Allow admins to upload banner media
CREATE POLICY "Admins can upload banner media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'banner-media' AND public.has_role(auth.uid(), 'admin'));

-- Allow admins to update banner media
CREATE POLICY "Admins can update banner media"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'banner-media' AND public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete banner media
CREATE POLICY "Admins can delete banner media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'banner-media' AND public.has_role(auth.uid(), 'admin'));