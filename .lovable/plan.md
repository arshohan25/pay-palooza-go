
## Remove Excess Top Space from All Flow Headers

### What's Happening

Every flow component (`SendMoneyFlow`, `CashOutFlow`, `PaymentFlow`, `MobileRechargeFlow`, `PayBillFlow`, `AddMoneyFlow`, `ChangePinFlow`, `KycFlow`) has its colored gradient header div set to `pt-14` (56px top padding). This was intended for safe-area spacing under the device status bar, but it is creating an oversized empty gap above the back button and title, as shown in the screenshot.

### The Fix

Reduce `pt-14` → `pt-6` across all 8 flow header divs. This brings the back button and title up close to the top of the gradient band, eliminating the dead space while keeping a small natural cushion.

`MobileRechargeFlow` also has a success screen header with `pt-16` which will be reduced to `pt-8` for consistency.

### Files to Change — Exact Locations

| File | Current value | Change to |
|---|---|---|
| `src/components/SendMoneyFlow.tsx` line 249 | `pt-14` | `pt-6` |
| `src/components/CashOutFlow.tsx` line 198 | `pt-14` | `pt-6` |
| `src/components/PaymentFlow.tsx` line 170 | `pt-14` | `pt-6` |
| `src/components/MobileRechargeFlow.tsx` line 353 | `pt-14` | `pt-6` |
| `src/components/MobileRechargeFlow.tsx` line 695 | `pt-16` | `pt-8` |
| `src/components/PayBillFlow.tsx` line 246 | `pt-14` | `pt-6` |
| `src/components/AddMoneyFlow.tsx` line 184 | `pt-14` | `pt-6` |
| `src/components/ChangePinFlow.tsx` line 214 | `pt-14` | `pt-6` |
| `src/components/KycFlow.tsx` line 389 | `pt-14` | `pt-6` |

### Result

The gradient header will be compact and tight, with the back button and title starting near the top — matching a premium, full-bleed header style like Revolut or Wise. No structural changes, only the single padding class per file.
