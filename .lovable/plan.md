

## Fix QR Share Button

The issue is that `navigator.share()` fails silently in the Lovable preview iframe (it's not supported in that context). The `handleShare` function in `WalletShareSheet` checks `navigator.share` which exists but throws when called inside an iframe, and the error is caught and swallowed.

Additionally, the console warning about "Function components cannot be given refs" in `WalletShareSheet` is caused by `AnimatePresence` wrapping `motion.span` inside a `Button` component — framer-motion tries to pass a ref to the function component child.

### Changes

**File: `src/components/WalletShareSheet.tsx`**

1. **Fix share handler** — Wrap `navigator.share()` call to catch the `NotAllowedError` / iframe restriction and fall back to copy + toast notification so the user gets feedback instead of nothing happening.

2. **Fix AnimatePresence ref warning** — Remove the `AnimatePresence` wrapper inside the Copy `Button` (lines 158-169). Use a simple conditional render instead, since the animation inside a button isn't essential and causes the ref warning.

3. **Add toast import** and show a success toast when falling back to copy, so the user knows something happened.

