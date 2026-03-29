

# Fix: Enforce KYC Verification Server-Side on All Transactions

## Problem
Currently, KYC verification is only enforced **client-side** via `FeatureGuard`. A user can bypass this by calling the database RPCs directly (e.g. via browser console or API). The `record_transaction` and `transfer_money` functions have no KYC check.

## Solution
Add a server-side KYC verification check inside both `record_transaction` and `transfer_money` RPCs. If the user has not completed KYC (and is not KYC-exempt), the transaction is rejected.

## Database Migration

Add a reusable helper function and update both RPCs:

### 1. New helper: `require_kyc_verified(p_user_id uuid)`
A `SECURITY DEFINER` function that checks:
- If `profiles.kyc_exempt = true` → pass
- If a `kyc_verifications` record exists with `status = 'verified'` → pass
- Otherwise → raise exception `'KYC verification required to perform transactions'`

### 2. Update `record_transaction`
Add `PERFORM require_kyc_verified(v_user_id);` right after the authentication check (after `v_user_id := auth.uid()`), before any balance operations.

### 3. Update `transfer_money`
Same — add `PERFORM require_kyc_verified(v_sender_id);` after the auth check.

### 4. Update `savings_deposit`
Same pattern — add KYC check after auth.

## Files Changed
- **1 database migration** — creates `require_kyc_verified` function and updates `record_transaction`, `transfer_money`, and `savings_deposit` RPCs
- **No frontend changes needed** — client-side `FeatureGuard` already blocks UI; this adds the critical server-side enforcement layer

## Security Impact
- Prevents any direct RPC call from bypassing KYC
- KYC-exempt users (set by admin) continue to work normally
- All existing UI flows remain unchanged

