

# Fix: Remove Auto-Applied Coupon, Keep Manual Input Only

## Problem
When a user visits the Coupons page and taps "Redeem", the coupon is stored in `sessionStorage` and auto-loaded into the Payment flow on mount (line 117). The user wants coupons to only be applied manually via the inline "Have a coupon?" input during payment.

## Changes

### 1. Remove auto-load from PaymentFlow.tsx
- Change line 117 from `useState<PendingCoupon | null>(() => getPendingCoupon("payment"))` to `useState<PendingCoupon | null>(null)`
- Remove the `getPendingCoupon` import if no longer needed

### 2. Update CouponsPage.tsx "Redeem" button behavior
- Instead of setting `pendingCoupon` in sessionStorage and navigating to the payment flow, the "Redeem" button should copy the coupon code to clipboard with a toast like "Code copied — paste it during payment" (or simply remove the auto-navigate behavior)

### Files Modified
- `src/components/PaymentFlow.tsx` — remove auto-coupon initialization
- `src/pages/CouponsPage.tsx` — change Redeem to copy code instead of auto-applying

