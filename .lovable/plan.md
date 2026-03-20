

## Redesign Payment Link Page — Premium Mobile-First

### What changes

1. **Remove "Pay from Wallet" option** — EasyPay is a mobile app, so browser-based wallet login isn't available on payment links. Remove the authenticated wallet pay button and `handleWalletPay` logic entirely.

2. **Remove "Show Dynamic QR" from ready screen** — Instead, always show a QR popup/modal. The Dynamic QR button moves to below the merchant header as a secondary action (available to everyone, not just authenticated users). Tapping it opens a centered modal/dialog with the QR code.

3. **Dynamic QR in a proper modal overlay** — Replace the inline QR section with a fixed fullscreen backdrop modal containing the QR code, merchant info, amount, and a close button. Premium glassmorphism style.

4. **Premium redesign of entire flow** — Elevate every step with:
   - Subtle gradient background with animated floating shapes
   - Glassmorphism card (backdrop-blur-xl, frosted border)
   - Refined typography hierarchy
   - Step progress indicator (dots) for Phone → OTP → PIN
   - Smoother spring animations between steps
   - Premium success screen with gradient ring animation
   - Refined error screen

### Changes to `src/pages/PayPage.tsx`

**Remove:**
- `isAuthenticated` / `user` usage from `useAuth` (keep import for potential future use but don't gate features)
- `handleWalletPay` function
- "Pay from Wallet" button block (lines 368-379)
- "Show Dynamic QR" button from ready screen (lines 355-366)
- Inline QR section at bottom (lines 478-488)

**Add/Replace:**
- Background: animated gradient with subtle floating orbs
- Card: `backdrop-blur-xl bg-card/80 border-white/10` glassmorphism
- Ready screen: Single "Pay with Phone & PIN" as the primary CTA button (not a list item), plus a secondary "Show QR Code" text button below
- QR Modal: `fixed inset-0 z-50 bg-black/60 backdrop-blur-sm` overlay with centered white card containing QR, merchant name, amount
- Step indicator: 3 dots showing progress through Phone → OTP → PIN
- Remove auth-gating from QR generation (QR encodes payment URL, available to all)
- Processing: refined pulsing animation
- Success: gradient checkmark with glow effect
- Footer: subtle "Secured by EasyPay" with lock icon

### No other files change — single file rewrite of PayPage.tsx.

