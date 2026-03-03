

## Generate PWA Icons from EasyPay Logo

### What We'll Do
Copy the uploaded EasyPay logo to serve as the PWA icons (192x192 and 512x512) and favicon, replacing the current generic icons.

### Steps

1. **Copy logo to PWA icon locations**: Copy `user-uploads://photo_2026-03-02_15-11-13.png` to:
   - `public/icons/icon-192.png` (overwrite)
   - `public/icons/icon-512.png` (overwrite)

2. **No config changes needed**: `vite.config.ts` and `index.html` already reference these paths and `public/icons/easypay-logo.png`.

Note: The uploaded image will be used directly. For production, ideally these would be resized to exact 192x192 and 512x512 dimensions, but browsers handle scaling well for PWA icons.

| File | Change |
|------|--------|
| `public/icons/icon-192.png` | Replace with EasyPay logo |
| `public/icons/icon-512.png` | Replace with EasyPay logo |

