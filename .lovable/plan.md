

## Brand the EasyPay Logo Everywhere

### What We'll Do
Copy the uploaded logo image into the project and replace every instance of the text-based logo (₿ or ৳ characters in boxes) with the actual logo image across the entire app.

### Logo Locations to Update

| Location | File | Current | Change |
|----------|------|---------|--------|
| Splash Screen | `src/components/SplashScreen.tsx` | ৳ text in rounded box | Logo `<img>` |
| Auth Page (Welcome) | `src/pages/AuthPage.tsx` | ৳ text in rounded box | Logo `<img>` |
| Side Navigation | `src/components/SideNav.tsx` | ₿ text in rounded box | Logo `<img>` |
| Biometric Auth | `src/components/BiometricAuth.tsx` | ₿ text in rounded box | Logo `<img>` |
| Favicon / PWA icons | `index.html`, `vite.config.ts` | Generic icon-192/512 | Update with logo |
| QR Modal | `src/components/UserQrModal.tsx` | N/A (no logo) | No change needed |

### Steps

1. **Copy logo to project**: Save uploaded image as `src/assets/easypay-logo.png`

2. **SplashScreen.tsx**: Replace the `<span className="text-5xl font-black text-white">৳</span>` with `<img src={logo} alt="EasyPay" className="w-16 h-16 object-contain" />`

3. **AuthPage.tsx** (line ~674): Replace the ৳ text div content with the logo image

4. **SideNav.tsx** (line ~39): Replace ₿ text with a small logo image (~24px)

5. **BiometricAuth.tsx** (line ~135): Replace ₿ text with logo image

6. **Favicon**: Copy logo to `public/icons/` and update references in `index.html`

All replacements will use an ES6 import (`import logo from "@/assets/easypay-logo.png"`) for proper bundling. The logo will have a transparent background as it's being placed on gradient and colored backgrounds.

