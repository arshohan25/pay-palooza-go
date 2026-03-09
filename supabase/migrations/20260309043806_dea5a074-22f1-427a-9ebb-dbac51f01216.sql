-- Add images array and video_url columns to merchant_products
ALTER TABLE merchant_products ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}';
ALTER TABLE merchant_products ADD COLUMN IF NOT EXISTS video_url text;

-- Drop and recreate the get_shop_products function with new columns
DROP FUNCTION IF EXISTS public.get_shop_products();

CREATE OR REPLACE FUNCTION public.get_shop_products()
RETURNS TABLE(
  id uuid,
  merchant_id uuid,
  name text,
  description text,
  price numeric,
  original_price numeric,
  category text,
  emoji text,
  image_url text,
  images text[],
  video_url text,
  stock integer,
  is_active boolean,
  badge text,
  badge_color text,
  rating numeric,
  review_count integer,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  vendor_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p.id, p.merchant_id, p.name, p.description, p.price, p.original_price,
    p.category, p.emoji, p.image_url, p.images, p.video_url, p.stock, p.is_active,
    p.badge, p.badge_color, p.rating, p.review_count,
    p.created_at, p.updated_at,
    m.business_name AS vendor_name
  FROM merchant_products p
  JOIN merchants m ON m.id = p.merchant_id
  WHERE p.is_active = true AND m.status = 'active'
  ORDER BY p.created_at DESC;
$$;