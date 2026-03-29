

# Fix Splash Screen Logo Not Showing

## Problem
The splash screen exits after ~550ms (300ms delay + 250ms exit animation). The logo image `/icons/easypay-logo.png` may not finish loading in that window, resulting in a blank logo box.

## Solution

### File: `src/components/SplashScreen.tsx`
1. **Preload the logo before showing content** — add state `logoLoaded` and preload the image in a `useEffect`. Only start the exit timer after the logo has loaded (or after a fallback timeout).
2. **Use a link preload in `index.html`** — add `<link rel="preload" as="image" href="/icons/easypay-logo.png">` so the browser fetches the logo early, before React even mounts.

### File: `index.html`
- Add `<link rel="preload" as="image" href="/icons/easypay-logo.png">` in the `<head>` section.

### Logic Change in SplashScreen
```
- Load logo via new Image() on mount
- Once loaded (or after 2s fallback), set logoLoaded = true
- Start exit timer only when logoLoaded is true
- This ensures the logo is visible before the splash fades out
```

## Summary
- 2 files changed: `index.html`, `src/components/SplashScreen.tsx`
- No backend changes

