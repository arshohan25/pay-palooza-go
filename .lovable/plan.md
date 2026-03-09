
## Plan: Multi-Image (up to 4) + Video Embed for Merchant Products

### Current State
- `merchant_products` table has single `image_url` column
- MerchantProductsTab supports one image upload
- ShopFlow displays single image per product

### Changes

**1. Database Migration**
Add new columns to `merchant_products`:
```sql
ALTER TABLE merchant_products ADD COLUMN images text[] DEFAULT '{}';
ALTER TABLE merchant_products ADD COLUMN video_url text;
```
Update `get_shop_products` RPC to include `images` and `video_url` in the return.

**2. MerchantProductsTab.tsx — Multi-Image + Video**
- Replace single image picker with a **4-slot image grid**:
  - Show uploaded images in a 2×2 grid layout
  - Each slot has upload/remove capability
  - First image = primary (shown in product cards)
  - Drag reordering not needed for v1
- Add **Video URL input** below images:
  - Text input for YouTube/Vimeo/other embed links
  - Auto-detect YouTube ID and show thumbnail preview
  - Helper text: "Paste YouTube, Vimeo, or embed link"
- Update form state: `images: string[]`, `video_url: string`
- Update save payload to include new fields

**3. ShopFlow.tsx — Gallery + Video Player**
- **Product Card**: Show first image from `images[]` array (fallback to `image_url` for backwards compat)
- **Product Detail**: 
  - Image carousel with dots/swipe for multiple images
  - Video embed section below images (if `video_url` present)
  - YouTube/Vimeo iframe rendering with aspect ratio
- **Cart/Order items**: Continue showing primary image

**4. ProductImage Component Update**
- Accept `images` array as prop
- Display first image or emoji fallback

### UI Design
```text
┌─────────────────────────────────────┐
│  Product Photos (up to 4)           │
├─────────┬─────────┬─────────┬───────┤
│  [IMG1] │  [IMG2] │  [IMG3] │ [IMG4]│
│  ✕      │  ✕      │   +     │   +   │
└─────────┴─────────┴─────────┴───────┘
│  Product Video (optional)           │
│  ┌─────────────────────────────────┐│
│  │ https://youtube.com/watch?v=... ││
│  └─────────────────────────────────┘│
│  [YouTube thumbnail preview]        │
└─────────────────────────────────────┘
```

### Video Embed Parsing
- Extract YouTube ID from various formats (`watch?v=`, `youtu.be/`, `embed/`)
- Support Vimeo (`vimeo.com/123456`)
- Render as responsive 16:9 iframe

### File Summary
| File | Action |
|------|--------|
| Migration SQL | Add `images[]`, `video_url` columns + update RPC |
| `MerchantProductsTab.tsx` | Multi-image grid, video URL input |
| `ShopFlow.tsx` | Image carousel, video embed in detail view |
| `ProductImage.tsx` | Accept images array |

