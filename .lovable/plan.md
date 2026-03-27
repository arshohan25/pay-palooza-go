

# Fix: PIN & Slider Not Resetting When Navigating Back

## Problem
In every transaction flow, when a user enters a PIN, goes back, then returns to the PIN step, the old PIN value is still filled in and the slider appears as if already used. The `goBack` and `goTo` functions only change the step — they never call `setPin("")`.

## Fix
Two changes per flow:

1. **Clear PIN on `goBack` from PIN step** — add `setPin("")` (and `setPinError("")`/`setPinVerified(false)` where applicable)
2. **Clear PIN when entering PIN step via `goTo("pin")`** — ensure `setPin("")` is called before navigating to PIN

### Files to edit (10 files)

| File | Change |
|------|--------|
| `src/components/SendMoneyFlow.tsx` | `goBack`: line 253 — add `setPin("")` when leaving pin step |
| `src/components/CashOutFlow.tsx` | `goBack`: line 187 — add `setPin("")` |
| `src/components/PaymentFlow.tsx` | `goBack`: line 196 — add `setPin("")` |
| `src/components/BankTransferFlow.tsx` | `goBack`: line 85 — add `setPin(""); setPinError(""); setPinVerified(false)` |
| `src/components/AddMoneyFlow.tsx` | `goBack`: line 97 — add `setPin(""); setPinError("")` |
| `src/components/PayBillFlow.tsx` | `goBack`: line 220 — add `setPin("")` |
| `src/components/MobileRechargeFlow.tsx` | `goBack`: line 303 — add `setPin("")` |
| `src/components/DynamicQrPaySheet.tsx` | Add `setPin("")` when navigating away from pin |
| `src/pages/AgentBillPay.tsx` | Already resets on done; add `setPin("")` on back from form |
| `src/pages/DonationsPage.tsx` | Add `setPin("")` on back from pin step |

Additionally, for every `goTo("pin")` / `setStep("pin")` call that doesn't already clear pin, add `setPin("")` before the navigation. This ensures entering the PIN step always starts fresh.

### Example change (SendMoneyFlow.tsx)
```typescript
// Before
if (step === "pin") { goTo("confirm"); return; }

// After
if (step === "pin") { setPin(""); goTo("confirm"); return; }
```

### Slider auto-reset
The `SlideToConfirm` component already resets when `disabled` flips (line ~53 in SlideToConfirm.tsx). Since clearing `pin` makes `pin.length < 4` → `disabled` becomes true → slider snaps back automatically. No changes needed to SlideToConfirm itself.

## Summary
- 10 files edited with the same 1-line pattern: `setPin("")` on leaving PIN step
- No backend or schema changes
- Slider resets automatically via existing `disabled` effect

