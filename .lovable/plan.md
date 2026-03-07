

## Plan: Empty State Illustrations & Spinner-Free Input Consistency

### 1. MobileRechargeFlow.tsx — Spinner-free amount input
The amount input at line 908 uses `type="tel"`. Change to `type="text"` with `inputMode="decimal"`, add regex validation (`/^\d*\.?\d*$/`), and append the spinner-hiding CSS classes for consistency with other flows.

### 2. Empty State Illustrations — CashOutFlow, PaymentFlow, SendMoneyFlow
Replace the plain text empty states with illustrated empty state components featuring an icon, title, and subtitle:

**CashOutFlow.tsx** (line 527): Replace `<p>No recent agents</p>` with an illustrated empty state using a `Users` icon + "No recent agents" + "Your cash out history will appear here".

**PaymentFlow.tsx** (line 348): Replace `<p>No recent merchants</p>` with an illustrated empty state using a `ShoppingBag` icon + "No recent merchants" + "Your payment history will appear here".

**SendMoneyFlow.tsx** (line 572-575): Already has an empty state but enhance it with an icon illustration for consistency.

Each empty state will follow this pattern:
```
[Icon in a soft circular background]
Title text (semi-bold)
Subtitle text (muted, smaller)
```

### 3. PayBillFlow & AddMoneyFlow — Already done
Both already have `type="text"` + `inputMode="decimal"` + regex validation + spinner-hiding CSS. No changes needed.

### Files Modified
- `src/components/MobileRechargeFlow.tsx`
- `src/components/CashOutFlow.tsx`
- `src/components/PaymentFlow.tsx`
- `src/components/SendMoneyFlow.tsx`

