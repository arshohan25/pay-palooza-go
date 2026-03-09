

## Fix: QR scan should auto-resolve recipient and skip to amount entry

### Problem
When scanning a QR code from the main "Scan & Pay" button:
- **Payment flow**: `Index.tsx` calls `setShowPayment(true)` but never passes the scanned merchant identifier to `PaymentFlow`. The flow opens at the "merchant" step, requiring manual entry.
- **Send Money flow**: `prefilledPhone` is set in the input field, but the flow still starts at "recipient" step. The user must manually tap "Send to this number" to validate and proceed.

### Fix

**1. `src/components/PaymentFlow.tsx`**
- Add `prefilledMerchantId?: string` prop
- Add a `useEffect` that, when `prefilledMerchantId` is provided, auto-validates it via `validateMerchantExists` RPC and jumps to "amount" step on success (same logic as `handleQrScan` but triggered on mount)

**2. `src/pages/Index.tsx`**
- Store scanned merchant identifier in state: `paymentPrefilledMerchant`
- In the QR `onScan` handler, when `parsed.flow === "payment"`, set `paymentPrefilledMerchant` to `parsed.identifier` before opening PaymentFlow
- In the RPC fallback payment case, do the same
- Pass it as `prefilledMerchantId` prop to `<PaymentFlow />`
- Clear it on close

**3. `src/components/SendMoneyFlow.tsx`**
- Add a `useEffect` that, when `prefilledPhone` is provided on mount, auto-runs `validateRecipientExists` and if found, sets recipient + jumps to "amount" step (same as `handleSelectContact` logic)

### Files Changed

| File | Change |
|------|--------|
| `PaymentFlow.tsx` | Add `prefilledMerchantId` prop + auto-resolve on mount |
| `SendMoneyFlow.tsx` | Auto-resolve `prefilledPhone` on mount and skip to amount |
| `Index.tsx` | Pass scanned merchant ID to PaymentFlow |

