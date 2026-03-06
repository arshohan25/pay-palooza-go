

## Plan: Replace Logo & Add manifest.json

### 1. Replace logo asset
Copy the uploaded image to both locations:
- `src/assets/easypay-logo.png` (used by React components via import)
- `public/icons/easypay-logo.png` (used as fallback and in HTML)
- `public/icons/icon-192.png` and `public/icons/icon-512.png` (PWA icons)
- `public/favicon.ico`

### 2. Add static `public/manifest.json`
Create a proper `manifest.json` in the public directory with complete icon declarations (including the logo as apple-touch-icon), shortcuts, and related_applications fields. This supplements the VitePWA-generated manifest.

Update `index.html` to add `<link rel="manifest" href="/manifest.json">`.

### 3. Update VitePWA config
Add the `easypay-logo.png` icon entry to the manifest icons array in `vite.config.ts` so VitePWA also references it, and split the `purpose` field into separate entries (`any` and `maskable`) per PWA best practices.

### Files modified
- `src/assets/easypay-logo.png` (replaced)
- `public/icons/easypay-logo.png` (replaced)
- `public/icons/icon-192.png` (replaced)
- `public/icons/icon-512.png` (replaced)
- `public/favicon.ico` (replaced)
- `public/manifest.json` (new)
- `index.html` (add manifest link)
- `vite.config.ts` (update icon declarations)

