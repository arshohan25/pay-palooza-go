

## Plan: Promo Banner Slider with Admin Management

### 1. Database: Create `promo_banners` table

```sql
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
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.promo_banners ENABLE ROW LEVEL SECURITY;

-- Everyone can read active banners
CREATE POLICY "Anyone can read active banners" ON public.promo_banners
  FOR SELECT USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- Only admins can manage banners
CREATE POLICY "Admins can manage banners" ON public.promo_banners
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
```

### 2. Replace `PromoCard` with `PromoSlider`

- Fetch active banners from `promo_banners` ordered by `sort_order`
- Use Embla carousel (already installed) with auto-play, loop, and dot indicators
- Each slide keeps the current card design but renders dynamic data (title, subtitle, badge, icon, gradient)
- Falls back to current hardcoded promo if no banners exist in DB

### 3. Admin Panel: Add "Banners" section

- Add `{ id: "banners", label: "Banners", icon: Image }` to `NAV_ITEMS` in AdminDashboard
- Create `src/components/admin/AdminBannerManager.tsx`:
  - List all banners (active/inactive) in a table
  - Add/Edit dialog with fields: title, subtitle, badge text, icon (dropdown of lucide icons), gradient colors, link URL, active toggle, expiry date, sort order
  - Delete with confirmation
  - Drag-to-reorder support via sort_order

### 4. Update `Index.tsx`

- Replace `<PromoCard />` with `<PromoSlider />` component

### Files to create/modify:
- **New**: `src/components/PromoSlider.tsx` — carousel of dynamic banners
- **New**: `src/components/admin/AdminBannerManager.tsx` — CRUD for banners
- **Modified**: `src/pages/Index.tsx` — swap PromoCard → PromoSlider
- **Modified**: `src/pages/AdminDashboard.tsx` — add "Banners" nav item and render AdminBannerManager
- **Migration**: Create `promo_banners` table with RLS

