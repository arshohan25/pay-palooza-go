

## Remove Choice Screen for Unauthenticated Users — Go Directly to Guest Pay

### Problem
When an unauthenticated user opens a payment link, they see a choice screen with "Log In to Pay" — this defeats the purpose of guest payment. The user wants anyone with a link to pay immediately without friction.

### Change

**`src/pages/PayPage.tsx`**
- When `!user`: skip the choice screen entirely and go straight to `GuestCheckoutFlow` (no intermediate screen)
- Remove the "Log In to Pay" button and related `LogIn` import
- When `user`: keep the choice screen with "Pay with Phone & PIN" and "Show Dynamic QR" options
- Simplify: unauthenticated visitors land directly on the phone → OTP → PIN flow

