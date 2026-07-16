
ALTER TABLE public.merchant_vendor_applications
  ADD COLUMN IF NOT EXISTS shop_front_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS shop_inside_photo_url TEXT;
