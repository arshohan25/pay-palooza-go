

# Fix Coupon Discount Logic — Apply to Amount, Not Fee

## Problem
1. **Coupon discount reduces the fee instead of the amount** — e.g., ৳50 coupon on a ৳500 Send Money with Free fee = still ৳500 deducted. The discount line shows but has no effect.
2. **Send Money should not accept coupons** — user wants coupons only for: Payment, Shop, Cash Out, Recharge, Bill Pay.

## Changes

### 1. Remove coupon from SendMoneyFlow.tsx
- Remove all coupon imports, state, and UI references
- Keep the flow clean — no coupon logic at all

### 2. Fix CashOutFlow.tsx — discount reduces amount, not fee
- Change: `couponDiscount` subtracts from the **amount sent to RPC**, not the fee
- Display: show original amount, coupon line, then "Total from balance" = amount - discount + fee
- RPC call uses `effectiveAmount` (amount minus discount)

### 3. Fix PaymentFlow.tsx — already reduces amount (verify correct)
- PaymentFlow already does `effectiveAmount = max(0, amtNum - couponDiscount)` — this looks correct. Just verify the RPC call uses `effectiveAmtVal`.

### 4. Fix MobileRechargeFlow.tsx — discount reduces amount
- Same pattern: subtract coupon from amount, not fee

### 5. Fix PayBillFlow.tsx — discount reduces amount  
- Same pattern: subtract coupon from bill amount

### 6. Update CouponsPage.tsx — remove send_money from flow options
- Remove `send_money` mapping from the "Use Now" navigation
- Only show coupon "Use Now" for: shop, payment, cash_out, recharge, bill_pay

### 7. Update couponStore.ts — no changes needed
- The store logic is fine; the bug is in how flows consume the discount

## Summary
- 6 files edited
- Core fix: `totalFromBalance = (amount - couponDiscount) + fee` instead of `amount + (fee - couponDiscount)`
- Remove coupon support from Send Money entirely

