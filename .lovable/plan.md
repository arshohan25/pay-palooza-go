

## Plan: Premium Payment Gateway Checkout Page Redesign

Redesign `CheckoutPage.tsx` with a world-class payment gateway UX inspired by UPI, BHIM, bKash, and Upay — combining the best elements into a superior experience.

### Design Inspiration Breakdown
- **UPI/BHIM**: Trusted green header band, verified merchant badge, clean confirmation summary
- **bKash**: Bold amount display, pink gradient accents, PIN dot animation, slide-to-pay
- **Upay**: Rounded cards, step progress dots, soft shadows, professional feel

### Visual Redesign

**1. Branded Gateway Header**
- Full-width emerald gradient header with EasyPay logo + "Secure Payment" tagline
- Animated shield/lock icon with a subtle pulse glow
- Countdown timer integrated into the header as a circular progress ring (not just text)

**2. Merchant Info Card (Login + Confirm steps)**
- Glassmorphic merchant card with merchant initial avatar (gradient circle)
- Merchant name bold, verified badge (checkmark), category tag
- Amount displayed as oversized centered typography with ৳ symbol in accent gold
- Reference and description as subtle pills below amount
- Subtle animated border shimmer on the amount card

**3. Login Step — Phone + PIN**
- Phone input with BD flag icon prefix and auto-format
- PIN entry using animated dot indicators (like bKash) instead of OTP slots — hidden input with 4 visual dots that fill with spring animation
- "Pay Securely" CTA button with gradient and lock icon
- Cancel as a ghost text link at bottom

**4. Confirm Step — Summary + Slide to Pay**
- Clean summary rows: To, Amount, Fee (Free badge), Ref
- Replace the plain "Pay" button with the existing `SlideToConfirm` component for premium feel (like bKash's swipe-to-pay)
- Back button as a subtle chevron link

**5. Processing Step**
- Animated concentric rings pulsing outward from center (not just a spinner)
- "Verifying payment..." text with dot animation

**6. Success Step**
- Large animated green checkmark with confetti burst (using existing `fireSuccessConfetti`)
- Amount and merchant name displayed
- "Redirecting..." progress bar if success_url exists
- "Go to EasyPay" button otherwise

**7. Failed/Expired/Error Steps**
- Polished illustrations with appropriate colors (amber for expired, red for failed)
- Clear CTAs

### Technical Changes

**File: `src/pages/CheckoutPage.tsx`** — Full visual rewrite of the JSX/styling while keeping all existing business logic (session loading, auth, payment RPC, webhook, countdown) untouched.

- Import `SlideToConfirm` for the confirm step
- Import `fireSuccessConfetti` for success animation
- Add animated PIN dots component (hidden input + visual dots with spring animation, matching existing pattern from PaymentFlow)
- Add circular countdown timer component (SVG circle with stroke-dashoffset animation)
- Use existing gradient CSS classes (`gradient-primary`, `gradient-payment`)
- Add EasyPay logo with onError fallback to `/icons/easypay-logo.png`

No database changes. No new dependencies. Pure UI/UX enhancement.

