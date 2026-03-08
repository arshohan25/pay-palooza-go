CREATE TABLE public.promo_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  badge_text text DEFAULT 'Limited Offer',
  icon text DEFAULT 'Gift',
  gradient_from text DEFAULT '#0ea5e9',
  gradient_to text DEFAULT '#06b6d4',
  link_url text,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.promo_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active banners" ON public.promo_banners
  FOR SELECT USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

CREATE POLICY "Admins can manage banners" ON public.promo_banners
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));