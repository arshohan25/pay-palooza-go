

# Fix: Reset PIN & T&C State on Navigation

## Problem
When a user enters a PIN and checks T&C acceptance on a confirmation screen, then navigates back and returns, the PIN dots and checkbox are still filled. The component stays mounted, so `useState` values persist across step transitions.

## Solution
Add a single `useEffect` that watches `step`, `goldStep`, and `stockStep` — whenever any of these change, clear PIN, pinError, termsAccepted, and tradeTermsAccepted. This ensures every time a user arrives at a confirmation screen, it's always fresh.

### Changes to `src/components/SavingsFlow.tsx`

1. **Add a cleanup effect** after the PIN state declarations (~line 207):
```typescript
// Reset PIN & acceptance whenever user navigates between steps
useEffect(() => {
  setPin("");
  setPinError("");
  setTermsAccepted(false);
  setTradeTermsAccepted(false);
}, [step, goldStep, stockStep]);
```

This single effect covers all flows:
- Savings review step (termsAccepted + pin)
- Gold buy/sell confirmation (tradeTermsAccepted + pin)  
- Stock buy/sell confirmation (tradeTermsAccepted + pin)
- Back navigation from any confirmation screen

No other files need changes — this is the root cause.

