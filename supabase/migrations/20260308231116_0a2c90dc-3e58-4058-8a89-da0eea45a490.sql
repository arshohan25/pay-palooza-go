
-- 1. Create merchant_products table
CREATE TABLE public.merchant_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  original_price numeric,
  category text NOT NULL DEFAULT 'General',
  emoji text NOT NULL DEFAULT '📦',
  image_url text,
  stock integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  badge text,
  badge_color text,
  rating numeric NOT NULL DEFAULT 0,
  review_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Add merchant_id to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS merchant_id uuid REFERENCES public.merchants(id);

-- 3. Enable RLS
ALTER TABLE public.merchant_products ENABLE ROW LEVEL SECURITY;

-- 4. Public read for active products
CREATE POLICY "Anyone can read active products"
  ON public.merchant_products FOR SELECT
  USING (is_active = true);

-- 5. Merchants can insert own products
CREATE POLICY "Merchants can insert own products"
  ON public.merchant_products FOR INSERT
  TO authenticated
  WITH CHECK (
    merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
  );

-- 6. Merchants can update own products
CREATE POLICY "Merchants can update own products"
  ON public.merchant_products FOR UPDATE
  TO authenticated
  USING (
    merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
  )
  WITH CHECK (
    merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
  );

-- 7. Merchants can delete own products
CREATE POLICY "Merchants can delete own products"
  ON public.merchant_products FOR DELETE
  TO authenticated
  USING (
    merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
  );

-- 8. Admins can do everything
CREATE POLICY "Admins full access merchant_products"
  ON public.merchant_products FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 9. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.merchant_products;

-- 10. RPC to fetch shop products with merchant name
CREATE OR REPLACE FUNCTION public.get_shop_products()
RETURNS TABLE (
  id uuid,
  merchant_id uuid,
  name text,
  description text,
  price numeric,
  original_price numeric,
  category text,
  emoji text,
  image_url text,
  stock integer,
  is_active boolean,
  badge text,
  badge_color text,
  rating numeric,
  review_count integer,
  created_at timestamptz,
  updated_at timestamptz,
  vendor_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id, p.merchant_id, p.name, p.description, p.price, p.original_price,
    p.category, p.emoji, p.image_url, p.stock, p.is_active,
    p.badge, p.badge_color, p.rating, p.review_count,
    p.created_at, p.updated_at,
    m.business_name AS vendor_name
  FROM merchant_products p
  JOIN merchants m ON m.id = p.merchant_id
  WHERE p.is_active = true AND m.status = 'active'
  ORDER BY p.created_at DESC;
$$;
