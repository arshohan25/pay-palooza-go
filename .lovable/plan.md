

# Fix: Restore Logo on Splash Screen

## Problem
The splash screen shows "EP" text instead of the actual EasyPay logo. The `src/assets/easypay-logo.webp` file is imported as an ES module, but appears to hit a Vite bundling/caching issue causing the wrong content to render. The `public/icons/easypay-logo.webp` file contains the correct logo.

## Solution
In `SplashScreen.tsx`, switch from the ES module import (`import logo from "@/assets/easypay-logo.webp"`) to the public URL path (`/icons/easypay-logo.webp`). This bypasses Vite's asset pipeline and serves the file directly. Apply the same fix to any other components showing the same issue (`AuthPage.tsx`, `BiometricAuth.tsx`, `SideNav.tsx`).

## Changes

**`src/components/SplashScreen.tsx`**
- Remove `import logo from "@/assets/easypay-logo.webp"`
- Change `src={logo}` to `src="/icons/easypay-logo.webp"`

**`src/pages/AuthPage.tsx`**
- Remove `import logo from "@/assets/easypay-logo.webp"`
- Change `src={logo}` to `src="/icons/easypay-logo.webp"`

**`src/components/BiometricAuth.tsx`**
- Remove `import logoImg from "@/assets/easypay-logo.webp"`
- Change `src={logoImg}` to `src="/icons/easypay-logo.webp"`

**`src/components/SideNav.tsx`**
- Remove `import logo from "@/assets/easypay-logo.webp"`
- Change `src={logo}` to `src="/icons/easypay-logo.webp"`

All four files get the same one-line change: swap the bundled import for the direct public path.

