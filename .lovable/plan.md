

## Checkout Page Redesign Plan

### Problem
1. **PIN Pay button missing**: Currently only auto-submit exists when 4 digits are entered, but no visible fallback button. If auto-submit fails silently or the `handleConfirmPin` dependency array causes a stale closure, the user is stuck.
2. **UI needs modernization**: User wants vertically centered, minimal card-based design.

### Changes (single file: `src/pages/CheckoutPage.tsx`)

**Bug Fix — PIN step**:
- Keep auto-submit on 4-digit completion
- Add a visible "Pay ৳X" button below the PIN input that enables when `pin.length === 4`
- This ensures users always have a clickable fallback

**UI Redesign — Modern Minimal Card**:
- Full viewport centered layout with subtle gradient background
- Single card container: `max-w-[400px]`, rounded-3xl, soft shadow, glass-like border
- All steps vertically centered within the card
- Cleaner typography hierarchy with more whitespace
- Merchant info as a compact top bar across all steps (not just phone)
- Amount displayed prominently as a hero element on every step
- Simplified footer branding
- Step indicator dots (phone → OTP → PIN) for progress awareness
- PIN step gets a prominent gradient "Pay ৳Amount" button below the input
- Consistent back navigation and timer placement

**Step-by-step structure per screen**:
1. **Phone**: Merchant header + amount hero + phone input + Send OTP button
2. **OTP**: Step dots + amount pill + OTP input + resend link
3. **PIN**: Step dots + amount pill + PIN input + **Pay ৳X button** + auto-submit
4. **Processing/Success/Failed**: Centered status cards (keep existing logic, refresh styling)

### No backend changes needed
The edge function and session logic remain unchanged. Only the frontend component is being redesigned.

