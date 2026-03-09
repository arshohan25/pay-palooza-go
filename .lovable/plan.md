

## Fix: Dynamic QR scanned inside PaymentFlow routes incorrectly

### Problem
When a user opens the QR scanner from **within PaymentFlow** (the Payment page's QR icon), and scans a dynamic payment QR (`type: "easypay"` with `sessionId`), the `handleQrScan` in `PaymentFlow.tsx` doesn't recognize the `dynamic_payment` flow. It just treats the raw JSON string as a merchant ID, which fails validation and shows the "Merchant not found" error.

The dynamic QR handling only exists in `Index.tsx`'s scan handler, not in `PaymentFlow.tsx`.

### Fix

**File: `src/components/PaymentFlow.tsx`**

Update `PaymentFlow` to:
1. Accept an optional `onDynamicQr` callback prop for routing dynamic payment QR scans back to the parent
2. In `handleQrScan`, check if `parsed.flow === "dynamic_payment"` — if so, call `onDynamicQr` with the session data and close PaymentFlow

**File: `src/pages/Index.tsx`**

Pass the `onDynamicQr` callback to `PaymentFlow` that sets `dynamicQrSession` state (same logic already used in the Scan & Pay handler).

### Changes

| File | Change |
|------|--------|
| `src/components/PaymentFlow.tsx` | Add `onDynamicQr?` prop, handle `dynamic_payment` flow in `handleQrScan` |
| `src/pages/Index.tsx` | Pass `onDynamicQr` callback to `PaymentFlow` |

