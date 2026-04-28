# Premium Yes/No Logout Confirmation

Redesign the merchant dashboard logout dialog into a compact, premium card with two small pill-shaped Yes/No buttons.

## Design

- **Compact card** (max-width 340px, 22px radius), glassmorphic dark gradient (slate → indigo) with rose + indigo bokeh blur accents.
- **Centered icon badge**: 48px rose-tinted gradient tile holding the `LogOut` icon, with a soft rose glow shadow.
- **Title**: "Sign out?" — short, tight tracking.
- **Description**: one short line — "You'll return to the merchant login screen."
- **Two small pill buttons, side-by-side, centered**:
  - **No** — ghost glass pill, white/15 border, subtle hover.
  - **Yes** — gradient rose pill (rose-500 → rose-600), glowing shadow, brighter on hover. Shows spinner + "..." while signing out.

Both buttons are ~88px min-width, 40px tall, rounded-full, 13px semibold — small but tactile and premium.

## Files

- `src/pages/MerchantDashboard.tsx` — replace the existing `<AlertDialog>` block (lines ~744–777) with the new compact layout. No state or handler changes — `handleLogout` and `loggingOut` continue to work as-is.

## Out of scope

- Other confirmation dialogs across the app (can adopt the same pattern later if desired).
