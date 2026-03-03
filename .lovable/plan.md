

## Fix: Logo Not Showing on Auth Page

### Analysis
The auth page (`AuthPage.tsx`) imports the logo from `src/assets/easypay-logo.png`. In my browser test, the logo renders correctly in the preview. However, you may be seeing a broken/cached version.

The fix will add a visible fallback so the logo always displays, even if the image fails to load, and will also add the logo from the `public/icons/` path as a secondary source.

### Changes

**`src/pages/AuthPage.tsx`** (line 675)
- Add an `onError` handler on the `<img>` tag that falls back to `/icons/easypay-logo.png` (the public copy)
- This ensures the logo displays even if the bundled asset path has issues

```tsx
<img
  src={logo}
  alt="EasyPay"
  className="w-24 h-24 rounded-[28px] object-contain shadow-float"
  onError={(e) => {
    e.currentTarget.src = "/icons/easypay-logo.png";
  }}
/>
```

**`src/components/SplashScreen.tsx`** (line ~61)
- Apply the same fallback to the splash screen logo

This is a minimal, safe change — one line added per logo instance.

