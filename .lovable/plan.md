

# Fix: Add Missing KYC Check to `transfer_money` RPC

## Problem
The `transfer_money` database function is **missing** the `require_kyc_verified` call. While `record_transaction` and `savings_deposit` both enforce KYC server-side, `transfer_money` does not — meaning Send Money, Cash In, and other transfer operations can proceed without KYC verification at the database level.

The first migration attempted to add it, but the function currently in the database does not include the check.

## Root Cause
The migration that was supposed to add `require_kyc_verified` to `transfer_money` either failed to apply or was overwritten by a subsequent migration that recreated the function without the check.

## Fix

### Database Migration
Create a new migration that adds `PERFORM require_kyc_verified(v_sender_id);` to the `transfer_money` function, placed right after the authentication check (`auth.uid()`) and before balance/validation logic.

The full function will be recreated with `CREATE OR REPLACE FUNCTION` preserving all existing logic but inserting the KYC check at line 18 (after `IF v_sender_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;`).

## Verification
- `record_transaction` — already has KYC check with recharge/addmoney exemption ✓
- `savings_deposit` — already has KYC check ✓
- `transfer_money` — will be fixed by this migration

## Files Changed
- 1 new database migration — adds `require_kyc_verified` call to `transfer_money` RPC

