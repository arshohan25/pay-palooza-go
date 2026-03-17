

## Add Banners & Marketing to E-Commerce Hub

The project already has fully-built components for both:
- **`AdminBannerManager`** — full CRUD for `promo_banners` (media upload, gradients, deep links, preview)
- **`AdminMarketingTools`** — promo codes, cashback rules, and campaigns with realtime sync

These just need to be wired into the E-Commerce Hub as new sub-tabs.

### Changes

**`src/components/admin/AdminEcommerceHub.tsx`**:
1. Import `AdminBannerManager` and `AdminMarketingTools`
2. Expand `SubTab` type to include `"banners"` and `"marketing"`
3. Add two entries to `SUB_TABS`:
   - `{ key: "banners", label: "Banners", icon: Image }` (from lucide)
   - `{ key: "marketing", label: "Marketing", icon: Megaphone }` (from lucide)
4. Add rendering: `{subTab === "banners" && <AdminBannerManager />}` and `{subTab === "marketing" && <AdminMarketingTools />}`
5. Import `Image` and `Megaphone` icons

This is a ~15-line edit to one file. No database changes needed — all tables and components already exist.

