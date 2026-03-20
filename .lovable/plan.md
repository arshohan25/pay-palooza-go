

## Remove "Pay Manually" Option & Simplify PayPage

The user wants to remove the "Pay Manually" button (highlighted in red in the screenshot) and keep only the guest pay + QR options for logged-in users, or guest pay + login for unauthenticated users.

### Changes

**`src/pages/PayPage.tsx`**
- Remove the "Pay Manually" button and its `mode === "manual"` handler (lines 88-100, 153-165)
- Remove `Keyboard` from lucide imports
- Remove `"manual"` from the mode type
- Remove the `PaymentFlow` import (no longer used)
- Keep: Guest pay (always visible), Show Dynamic QR (logged in), Log In to Pay (not logged in)

