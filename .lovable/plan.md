

# Add Coupon Input During Payment Flow (Merchant-Validated)

## What Changes

Users can enter a coupon code directly in the Payment flow's **Amount step** — no need to visit the Coupons page first. The coupon is validated in real-time against the selected merchant via the existing `apply-coupon` edge function.

## Plan

### 1. Add inline coupon input to PaymentFlow.tsx (Amount step)

Below the note/reference input, add a collapsible "Have a coupon?" section:
- A text input for the coupon code + "Apply" button
- On submit, call `supabase.functions.invoke("apply-coupon")` with `{ code, cart_total: amtNum, merchant_id: merchant?.id }` — using the resolved merchant's profile UUID
- On success: set `pendingCoupon` state from the response (same shape as `PendingCoupon`)
- On error: show inline error message (e.g. "Invalid code", "Not valid for this merchant")
- If a coupon is already applied, show the existing `CouponBanner` instead of the input

### 2. Resolve merchant profile UUID

The current merchant object uses transaction-derived IDs. To validate coupons against `merchant_id` (UUID), look up the merchant's profile UUID when resolving via `resolve_transfer_recipient`. The RPC already returns enough data — store the resolved user UUID in state (e.g. `resolvedMerchantUserId`).

### 3. UI details

- "Have a coupon?" link toggles the input — keeps the flow clean by default
- Input: dashed border style matching the coupon aesthetic, uppercase transform
- Apply button: compact, primary variant
- Loading state during validation
- Error text below input
- Once applied, input collapses and `CouponBanner` appears above

### Files Modified
- `src/components/PaymentFlow.tsx` — add coupon input UI, merchant UUID resolution, apply-coupon invocation

