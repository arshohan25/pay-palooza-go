

## Plan: Linkable Banners with Media Upload Support

### Overview
Make promo banners clickable to open any app feature, and allow admins to upload images/GIFs/videos as banner backgrounds.

### 1. Database Migration
Add two new columns to `promo_banners`:
- `media_url` (text, nullable) — URL of uploaded image/GIF/video
- `media_type` (text, nullable) — `image`, `gif`, or `video`

Create a `banner-media` storage bucket (public) with RLS policies allowing admin uploads and public reads.

### 2. Internal Feature Linking System
Replace the free-text "Link URL" field in `AdminBannerManager` with a dropdown of linkable targets:

| Link Value | Opens |
|---|---|
| `feature:sendmoney` | Send Money flow |
| `feature:cashout` | Cash Out flow |
| `feature:payment` | Payment flow |
| `feature:recharge` | Mobile Recharge |
| `feature:paybill` | Pay Bill |
| `feature:addmoney` | Add Money |
| `feature:shop` | Shop |
| `feature:banktransfer` | Bank Transfer |
| `feature:savings` | Savings |
| `feature:refer` | Refer page |
| `feature:kyc` | KYC flow |
| `feature:history` | Transaction History |
| External URL | Opens in new tab |

### 3. PromoSlider Changes (`src/components/PromoSlider.tsx`)
- Accept an `onFeatureOpen` callback prop from `Index.tsx` that maps feature keys to their respective `setState(true)` calls
- Wrap each slide in a clickable element; on click:
  - If `link_url` starts with `feature:`, call the corresponding feature opener
  - If it's an external URL, open in new tab
- If `media_url` exists, render image/video as banner background instead of (or overlaying) the gradient
- Fetch `media_url` and `media_type` in the query

### 4. Index.tsx Changes
- Pass a `onFeatureOpen` handler to `PromoSlider` that maps feature keys to the existing state setters (e.g., `sendmoney` → `setShowSendMoney(true)`)

### 5. AdminBannerManager Changes (`src/components/admin/AdminBannerManager.tsx`)
- Add media upload section with file input accepting `image/*,video/*,.gif`
- Upload to `banner-media` bucket via Supabase Storage
- Show preview of uploaded media in the form
- Replace "Link URL" text input with:
  - A select dropdown for internal features
  - A toggle to switch between "Internal Feature" and "External URL"
- Show media thumbnail in the banner list

### Files Modified
- **Migration**: Add `media_url`, `media_type` columns + storage bucket
- `src/components/PromoSlider.tsx` — clickable slides, media rendering
- `src/components/admin/AdminBannerManager.tsx` — feature link dropdown, media upload
- `src/pages/Index.tsx` — pass feature opener map to PromoSlider

