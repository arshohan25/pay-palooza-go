

# Fix PIN Reset Globally

## Problem
PIN fields don't consistently clear after errors across the app. Some `catch` blocks clear PIN, others don't. The `tradeTermsAccepted` state also doesn't reset on errors, leaving the slider locked. The user wants a reliable, centralized pattern.

## Solution

### 1. Create a reusable `usePinState` hook — `src/hooks/use-pin-state.ts`
Centralizes PIN state management so every flow behaves identically:
```typescript
export function usePinState() {
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  
  const clearPin = () => { setPin(""); setPinError(""); };
  const failPin = (msg?: string) => { 
    setPin(""); 
    setPinError(msg || "Incorrect PIN. Please try again."); 
  };
  
  return { pin, setPin, pinError, setPinError, clearPin, failPin };
}
```

### 2. Fix `SavingsFlow.tsx` — ensure every catch block clears PIN + tradeTermsAccepted
- `handleSave` catch: add `setPin("")`
- `handleAutoSave` catch: add `setPin("")`  
- All 4 trade catch blocks: add `setTradeTermsAccepted(false)` alongside existing `setPin("")`

### 3. Audit and fix all other PIN flows (11 files)
Ensure every `catch` block and error path calls `setPin("")`:
- `SendMoneyFlow.tsx` — verify catch clears PIN
- `CashOutFlow.tsx` — verify catch clears PIN
- `PaymentFlow.tsx` — verify catch clears PIN
- `PayBillFlow.tsx` — verify catch clears PIN
- `BankTransferFlow.tsx` — verify catch clears PIN
- `MobileRechargeFlow.tsx` — verify catch clears PIN
- `AddMoneyFlow.tsx` — verify catch clears PIN
- `ShopFlow.tsx` — verify catch clears PIN
- `ShopCheckoutPage.tsx` — verify catch clears PIN
- `AgentBillPay.tsx` — verify catch clears PIN
- `AgentB2B.tsx` — verify catch clears PIN
- `AgentBankTransfer.tsx` — verify catch clears PIN
- `MerchantDashboard.tsx` — verify catch clears PIN
- `LoanPage.tsx` — verify catch clears PIN

### 4. Fix SlideToConfirm reset reliability
Add a `key` prop or explicit reset mechanism so that when `onConfirm` fires but the transaction fails, the slider fully resets (confirmed state + thumb position). Currently the `disabled` effect handles this, but add a safety reset: also reset `confirmed` when `processing` goes from true to false.

### File changes
- **New**: `src/hooks/use-pin-state.ts` — reusable hook
- **Edit**: `src/components/SavingsFlow.tsx` — fix missing PIN clears in catch blocks, reset `tradeTermsAccepted` on error
- **Edit**: All 14 PIN-using files — audit and add missing `setPin("")` in catch/error paths
- **Edit**: `src/components/SlideToConfirm.tsx` — add processing-aware reset

