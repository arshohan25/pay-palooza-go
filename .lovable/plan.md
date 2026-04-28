## Problem

On the Merchant (owner) login screen, the 4-digit PIN is rendered as plain digits (`1 1 2 2` visible in the screenshot) even though the intent is to mask them. The current code tries to hide the text with `color: transparent` + `textShadow`, but that style is set on the slot's wrapper `<div>` while the `InputOTPSlot` component renders the actual digit (`{char}`) as a child text node — so the trick doesn't take effect and the raw PIN is shown.

The Manager login screen has the same OTP slot setup and is affected too.

## Fix

1. **`src/components/ui/input-otp.tsx`** — Add a `mask?: boolean` prop to `InputOTPSlot`. When `mask` is true and the slot has a character, render a small filled circle (`<span className="block h-2.5 w-2.5 rounded-full bg-current" />`) instead of the raw `{char}`. The fake caret behavior is preserved.

2. **`src/pages/MerchantLoginPage.tsx`** — Replace the brittle `style={{ color: "transparent", textShadow: ... }}` masking on each slot with the new `mask` prop:
   ```tsx
   <InputOTPSlot key={i} index={i} mask className="..." />
   ```

3. **`src/pages/MerchantManagerLoginPage.tsx`** — Apply the same `mask` prop to its PIN slots so the manager screen also shows dots instead of digits.

## Why this works

`InputOTPSlot` owns the rendering of the character. By moving the masking inside the slot component (rendering a dot element instead of the digit), the actual PIN value is never painted to the DOM as visible text — no DevTools "select text" reveal, no rendering-engine fallback, and it works regardless of font/color overrides.

No backend, schema, or auth flow changes are needed. The PIN value in state remains untouched; only its visual representation changes.
