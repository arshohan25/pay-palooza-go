

## Plan: Spinner-Free Inputs & Remove Mock Data Across All Flows

### 1. AddMoneyFlow.tsx — Spinner-free amount input
- Line 552: Change `type="number"` to `type="text"` with `inputMode="decimal"`
- Update `onChange` to validate with `/^\d*\.?\d*$/`
- Add CSS classes: `[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`

### 2. PayBillFlow.tsx — Remove mock bill generation
- Lines 129–148: The `generateBillAmount` function generates fake random bill amounts. Replace this with a user-entered amount field — the user enters the bill amount manually (since there's no real bill API connected). Remove the mock `due`, `month`, `dueDate` auto-generation and let the user input the amount on the "bill" step instead of showing fake generated values.

### 3. PaymentFlow.tsx — Remove mock merchants, load from real transactions
- Lines 43–50: Delete the `RECENT_MERCHANTS` hardcoded array.
- Add a `useEffect` that fetches recent "payment" type transactions from the database (similar to SendMoneyFlow's approach), extracting unique merchant names/IDs from `recipient_phone` and `recipient_name`.
- If no payment transactions exist, show an empty state instead of fake merchants.
- Update `handleQrScan` and `handleMerchantIdContinue` to not rely on matching against mock data — just use the entered/scanned merchant ID directly.

### 4. CashOutFlow.tsx — Remove mock agents and banks
- Lines 66–72: Delete `NEARBY_AGENTS` mock array. 
- Lines 89–98: The `BANKS` array is a static reference list (not transaction data) — keep it as-is since these are real bank names.
- For agents: fetch recent cash-out transactions from the database to populate the "recent agents" list. If none exist, show empty state.

### 5. MobileRechargeFlow.tsx — No mock data found, no `type="number"` found
- Already clean. No changes needed.

### Files Modified
- `src/components/AddMoneyFlow.tsx`
- `src/components/PayBillFlow.tsx`
- `src/components/PaymentFlow.tsx`
- `src/components/CashOutFlow.tsx`

