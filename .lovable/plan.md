

# Exempt Recharge, Add Money & Shop from KYC Requirement

## Problem
Currently, `FeatureGuard` blocks ALL features for non-KYC users, including Recharge, Add Money, and Shop. The server-side RPCs also enforce KYC on all transaction types. The user wants these three flows to be accessible without KYC.

## Changes

### 1. Client-side: `src/components/FeatureGuard.tsx`
- Add a list of KYC-exempt feature keys: `["mobile_recharge", "add_money"]`
- Note: Shop uses `featureKey="payment"` which is shared with the Payment flow. Instead of exempting `"payment"`, we'll add a new optional prop `skipKyc?: boolean` to `FeatureGuard`
- When `skipKyc` is true OR the featureKey is in the exempt list, skip the KYC check (still enforce global toggles and feature locks)

### 2. Client-side: Update guarded wrappers
- `MobileRechargeFlow.tsx` — already uses `featureKey="mobile_recharge"`, will be auto-exempt
- `AddMoneyFlow.tsx` — already uses `featureKey="add_money"`, will be auto-exempt  
- `ShopFlow.tsx` — add `skipKyc` prop to its `FeatureGuard` wrapper

### 3. Server-side: Database migration
- Update `record_transaction` RPC — skip `require_kyc_verified` when `p_type` is `'recharge'` or `'addmoney'`
- `place_shop_order` RPC — does NOT currently call `require_kyc_verified`, so shop orders already work server-side (no change needed)
- `transfer_money` and `savings_deposit` — keep KYC enforcement (these are Send Money, Cash Out, Payment, etc.)

### 4. Server-side: `process-recharge` edge function
- Already has no KYC check — no change needed

## Files Changed
- `src/components/FeatureGuard.tsx` — add `skipKyc` prop + KYC-exempt feature key list
- `src/components/ShopFlow.tsx` — pass `skipKyc` to FeatureGuard
- 1 database migration — update `record_transaction` to skip KYC for recharge/addmoney types

