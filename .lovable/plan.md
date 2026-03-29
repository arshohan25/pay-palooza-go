

# Add Uploaded Logo to Splash Screen

## Overview
Replace the current generated logo with the user's uploaded EasyPay logo image across the splash screen and HTML splash fallback.

## Steps

### 1. Copy logo to project
- Copy `user-uploads://photo_2026-03-02_15-11-13-3.png` → `public/icons/easypay-logo.png` (overwrite existing empty/generated file)

### 2. Update `index.html` — HTML splash fallback
- Replace the inline SVG placeholder (the "EP" text circle) with an `<img src="/icons/easypay-logo.png" width="64" height="64" alt="EasyPay">` tag
- This ensures the real logo shows even before React mounts

### 3. Verify `src/components/SplashScreen.tsx`
- Already references `/icons/easypay-logo.png` with preload logic — no changes needed there

## Files Changed
- `public/icons/easypay-logo.png` — replaced with uploaded logo
- `index.html` — swap SVG for `<img>` in HTML splash

