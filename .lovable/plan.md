

# Smart Continue/Review Button Visibility Across All Flows

## Problem
All transaction flow "Continue" / "Review Transfer" buttons are always visible, even when no amount is entered, when the amount exceeds the available balance, or when it exceeds limits. The button should only appear when the entered amount is valid and affordable.

## Approach
Apply the same pattern to all 6 flows: conditionally render the continue button based on three checks:
1. Amount > 0
2. Total deduction (amount + fee from balance) does not exceed available balance
3. Amount does not exceed the flow's max limit

When the button is hidden due to balance or limit issues, show an inline warning message instead.

## Files to Edit

### 1. `src/components/SendMoneyFlow.tsx` (~line 851)
- Hide "Review Transfer" button when `amtNum <= 0`, `totalFromBalance > BALANCE`, or `amtNum > 50000`
- Show inline error text ("Insufficient balance" / "Exceeds daily limit") when applicable
- Animate button appearance with a simple fade transition

### 2. `src/components/CashOutFlow.tsx` (~line 583)
- Same logic: hide "Continue to PIN" when `amtNum <= 0`, `totalFromBalance > BALANCE`, or `amtNum > 50000`
- `BALANCE` and `totalFromBalance` already computed (line ~318-328)

### 3. `src/components/PaymentFlow.tsx` (~line 556)
- Payment has no max limit, so only check `amtNum > 0` and `amtNum <= BALANCE`
- Need to add `getBalance` import and compute `BALANCE`

### 4. `src/components/BankTransferFlow.tsx` (~line 322)
- Hide button when `amtNum <= 0`, total > balance, or `amtNum > 50000`
- Need to add `getBalance` import and compute balance/fee values

### 5. `src/components/AddMoneyFlow.tsx` (~line 302)
- Add Money increases balance, so only check `amtNum > 0` and `amtNum <= 100000` (max)
- No balance insufficiency check needed (user is adding money in)

### 6. `src/components/MobileRechargeFlow.tsx` (~line 1009)
- Hide button when `customAmountNum < 20`, `customAmountNum > 1000`, or `customAmountNum > BALANCE`
- Need to import `getBalance`

## Button Visibility Logic (shared pattern)
```tsx
// Example for SendMoneyFlow:
const canProceed = amtNum > 0 && totalFromBalance <= BALANCE && amtNum <= 50000;

{amtNum > 0 && !canProceed && (
  <p className="text-center text-sm text-destructive font-medium">
    {totalFromBalance > BALANCE ? "Insufficient balance" : "Exceeds daily limit"}
  </p>
)}

{canProceed && (
  <Button className="w-full h-12 ..." onClick={handleAmountContinue}>
    Review Transfer
  </Button>
)}
```

## Summary
- **6 files** modified with the same conditional-render pattern
- Button hidden until valid amount entered; inline warnings for balance/limit violations
- No backend changes needed

