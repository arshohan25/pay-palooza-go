

## Root Cause: `protect_profile_fields` Trigger Blocks RPC Balance Updates

### What's Happening

The `admin_disburse_funds` RPC **did run successfully** — it inserted the transaction record (+৳100,000, balance_after = ৳518,756) and attempted to update the profile balance. However, the `protect_profile_fields` trigger **silently reverted the balance change**.

The trigger checks:
```sql
IF current_setting('role') != 'service_role' AND current_setting('role') != 'rls_none' THEN
  NEW.balance := OLD.balance;  -- REVERTS the change
END IF;
```

Even though `admin_disburse_funds` is `SECURITY DEFINER`, `current_setting('role')` still returns `'authenticated'` (the caller's session role), not `'service_role'`. So the trigger treats it as a regular client update and blocks the balance change.

**Evidence:** The transaction shows `balance_after = ৳518,756` but the actual profile balance is `৳418,756` — exactly ৳100,000 less.

This also explains why **all previous disbursements and RPC-based balance changes** may have had the same problem. Every `transfer_money`, `record_transaction`, `admin_disburse_funds`, and `admin_chargeback` RPC is affected.

### Fix

**Database Migration (single migration, two parts):**

1. **Fix the trigger** — Check `current_user` (which IS changed by `SECURITY DEFINER` to the function owner, typically `'postgres'`) instead of only `current_setting('role')`:
   ```sql
   IF NEW.balance IS DISTINCT FROM OLD.balance THEN
     IF current_user NOT IN ('postgres', 'supabase_admin')
        AND current_setting('role') NOT IN ('service_role', 'rls_none') THEN
       NEW.balance := OLD.balance;
     END IF;
   END IF;
   ```
   Apply the same pattern to the `phone` and `status` guards in the trigger.

2. **Repair Shohan's balance** — Set it to the correct value (৳518,756) that reflects the successful disbursement.

No code changes needed — this is purely a database trigger fix.

### Files
- **DB Migration**: Update `protect_profile_fields()` trigger + repair balance for user `01909709954`

