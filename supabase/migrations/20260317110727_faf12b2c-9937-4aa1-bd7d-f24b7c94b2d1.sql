
-- ============================
-- Phase 1: Multi-Vendor Marketplace Schema
-- ============================

-- 1. vendor_stores: Store profile per merchant
CREATE TABLE public.vendor_stores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  store_name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  banner_url TEXT,
  rating NUMERIC NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  social_links JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_vendor_stores_merchant ON public.vendor_stores(merchant_id);
CREATE INDEX idx_vendor_stores_slug ON public.vendor_stores(slug);

ALTER TABLE public.vendor_stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active stores" ON public.vendor_stores FOR SELECT USING (is_active = true);
CREATE POLICY "Merchants can manage own store" ON public.vendor_stores FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid())
);
CREATE POLICY "Admins can manage all stores" ON public.vendor_stores FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. product_variants: Size/color/SKU per product
CREATE TABLE public.product_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.merchant_products(id) ON DELETE CASCADE,
  sku TEXT,
  variant_name TEXT NOT NULL,
  variant_value TEXT NOT NULL,
  price_adjustment NUMERIC NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_variants_product ON public.product_variants(product_id);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active variants" ON public.product_variants FOR SELECT USING (is_active = true);
CREATE POLICY "Merchants can manage own product variants" ON public.product_variants FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM merchant_products mp JOIN merchants m ON m.id = mp.merchant_id WHERE mp.id = product_id AND m.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM merchant_products mp JOIN merchants m ON m.id = mp.merchant_id WHERE mp.id = product_id AND m.user_id = auth.uid())
);
CREATE POLICY "Admins can manage all variants" ON public.product_variants FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. product_reviews: Customer reviews
CREATE TABLE public.product_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.merchant_products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  body TEXT,
  images TEXT[] DEFAULT '{}',
  is_verified_purchase BOOLEAN NOT NULL DEFAULT false,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, user_id, order_id)
);
CREATE INDEX idx_product_reviews_product ON public.product_reviews(product_id);
CREATE INDEX idx_product_reviews_user ON public.product_reviews(user_id);

ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view visible reviews" ON public.product_reviews FOR SELECT USING (is_visible = true);
CREATE POLICY "Users can create own reviews" ON public.product_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reviews" ON public.product_reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all reviews" ON public.product_reviews FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. wishlists: User favorites
CREATE TABLE public.wishlists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.merchant_products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);
CREATE INDEX idx_wishlists_user ON public.wishlists(user_id);

ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wishlist" ON public.wishlists FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can add to own wishlist" ON public.wishlists FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove from own wishlist" ON public.wishlists FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 5. coupons: Discount codes
CREATE TABLE public.coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'flat')),
  discount_value NUMERIC NOT NULL DEFAULT 0,
  max_discount NUMERIC,
  min_order_amount NUMERIC DEFAULT 0,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE,
  usage_limit INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_coupons_code ON public.coupons(code);
CREATE INDEX idx_coupons_merchant ON public.coupons(merchant_id);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active coupons" ON public.coupons FOR SELECT USING (is_active = true);
CREATE POLICY "Merchants can manage own coupons" ON public.coupons FOR ALL TO authenticated USING (
  merchant_id IS NOT NULL AND EXISTS (SELECT 1 FROM merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid())
) WITH CHECK (
  merchant_id IS NOT NULL AND EXISTS (SELECT 1 FROM merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid())
);
CREATE POLICY "Admins can manage all coupons" ON public.coupons FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6. delivery_addresses: Saved shipping addresses
CREATE TABLE public.delivery_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  label TEXT NOT NULL DEFAULT 'Home',
  recipient_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address_line TEXT NOT NULL,
  city TEXT NOT NULL,
  area TEXT,
  postal_code TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_delivery_addresses_user ON public.delivery_addresses(user_id);

ALTER TABLE public.delivery_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own addresses" ON public.delivery_addresses FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 7. order_items: Normalized line items for multi-vendor orders
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.merchant_products(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_image TEXT,
  variant_label TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  subtotal NUMERIC NOT NULL,
  vendor_commission NUMERIC NOT NULL DEFAULT 0,
  platform_fee NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_items_order ON public.order_items(order_id);
CREATE INDEX idx_order_items_merchant ON public.order_items(merchant_id);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own order items" ON public.order_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.user_id = auth.uid())
);
CREATE POLICY "Merchants can view their order items" ON public.order_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid())
);
CREATE POLICY "Merchants can update their order items status" ON public.order_items FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid())
);
CREATE POLICY "Admins can manage all order items" ON public.order_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "System can insert order items" ON public.order_items FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.user_id = auth.uid())
);

-- 8. Alter merchant_products: add sku, brand, tags, weight
ALTER TABLE public.merchant_products
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS weight_grams INTEGER;

CREATE INDEX idx_merchant_products_sku ON public.merchant_products(sku) WHERE sku IS NOT NULL;
CREATE INDEX idx_merchant_products_brand ON public.merchant_products(brand) WHERE brand IS NOT NULL;
CREATE INDEX idx_merchant_products_tags ON public.merchant_products USING GIN(tags);

-- 9. Alter orders: add multi-vendor and escrow columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES public.coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coupon_discount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_vendor_commission NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_platform_fee NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS escrow_status TEXT DEFAULT 'none' CHECK (escrow_status IN ('none', 'held', 'released', 'refunded')),
  ADD COLUMN IF NOT EXISTS escrow_released_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_address_id UUID REFERENCES public.delivery_addresses(id) ON DELETE SET NULL;

-- Enable realtime on key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vendor_stores;
