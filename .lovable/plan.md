

## Fix Banner Size & Title Requirement

### Issues
1. **Banner size not fixed**: The PromoSlider has no fixed height — banner height varies based on content/media, causing layout shifts.
2. **Title mandatory**: The `title` column is `NOT NULL` in the database, and the save function requires `form.title.trim()`. When uploading a media-only banner (image/video), the admin shouldn't need a title.

### Changes

**1. Database Migration**
```sql
ALTER TABLE public.promo_banners ALTER COLUMN title DROP NOT NULL;
ALTER TABLE public.promo_banners ALTER COLUMN title SET DEFAULT '';
```

**2. `src/components/admin/AdminBannerManager.tsx`**
- Remove the `if (!form.title.trim())` validation check on line 178 — title is now optional.
- Update the label from `Title *` to `Title (optional for media banners)`.

**3. `src/components/PromoSlider.tsx`**
- Add a fixed height to the banner container: `h-[140px]` so all banners render at consistent size.
- Conditionally render title/subtitle only when they exist (title is already rendered unconditionally on line 161).

### Files Modified
- **Migration** — Make `title` nullable
- **`src/components/admin/AdminBannerManager.tsx`** — Remove title validation, update label
- **`src/components/PromoSlider.tsx`** — Fixed banner height, conditional title rendering

