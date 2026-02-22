

## Admin Chargeback Feature

### Overview
Allow admins to deduct (charge back) funds from any user's account directly from the Admin Dashboard. This is useful for reversing fraudulent transactions, correcting errors, or enforcing penalties. Every chargeback is recorded as a transaction with full audit trail.

### What Changes

**1. New database function: `admin_chargeback` (migration)**

A `SECURITY DEFINER` RPC that:
- Accepts target user ID, amount, reason/description, and optional reference transaction ID
- Verifies the caller has the `admin` role using `has_role()`
- Locks the target user's profile row (`FOR UPDATE`) to prevent race conditions
- Deducts the specified amount from their balance (capped at 0 -- balance cannot go negative)
- Inserts a transaction record of type `chargeback` for the target user
- Inserts an audit log entry recording which admin performed the chargeback
- Returns the new balance and success status

Also adds `chargeback` to the `txn_type` enum so it integrates with the existing transaction system.

**2. New component: `src/components/admin/AdminChargebackDialog.tsx`**

A dialog/modal that admins can trigger from:
- The Activity Monitor (per-transaction "Chargeback" button in expanded row details)
- The User Management tab (per-user "Chargeback" button)

The dialog includes:
- Read-only display of the target user (name, phone, current balance)
- Amount input field with validation (must be positive, cannot exceed user's balance)
- Reason/description textarea (required)
- Optional reference to original transaction ID
- Confirmation step before executing
- Success/error feedback via toast

**3. Update `src/components/admin/AdminActivityMonitor.tsx`**

- Add a "Chargeback" button in the expanded row detail panel for each transaction
- Clicking it opens the chargeback dialog pre-filled with the transaction's user, amount, and reference ID

**4. Update `src/pages/AdminDashboard.tsx`**

- Add a "Chargeback" button in the Users sub-tab for each user row
- Clicking it opens the chargeback dialog pre-filled with the user's info

### Technical Details

**Database migration SQL:**
```sql
-- Add chargeback to txn_type enum
ALTER TYPE public.txn_type ADD VALUE IF NOT EXISTS 'chargeback';

-- Admin chargeback RPC
CREATE OR REPLACE FUNCTION public.admin_chargeback(
  p_target_user_id UUID,
  p_amount NUMERIC,
  p_reason TEXT,
  p_reference_txn_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin_id UUID;
  v_target_balance NUMERIC;
  v_new_balance NUMERIC;
  v_actual_deduction NUMERIC;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL OR NOT has_role(v_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  SELECT balance INTO v_target_balance
  FROM profiles WHERE user_id = p_target_user_id FOR UPDATE;

  IF v_target_balance IS NULL THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  v_actual_deduction := LEAST(p_amount, v_target_balance);
  v_new_balance := v_target_balance - v_actual_deduction;

  UPDATE profiles SET balance = v_new_balance
  WHERE user_id = p_target_user_id;

  INSERT INTO transactions (user_id, type, amount, fee, balance_after,
    description, reference, status)
  VALUES (p_target_user_id, 'chargeback', v_actual_deduction, 0,
    v_new_balance, p_reason,
    COALESCE(p_reference_txn_id::text, NULL), 'completed');

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (v_admin_id, 'chargeback', 'profile', p_target_user_id,
    jsonb_build_object(
      'amount', v_actual_deduction,
      'reason', p_reason,
      'previous_balance', v_target_balance,
      'new_balance', v_new_balance,
      'reference_txn_id', p_reference_txn_id
    ));

  RETURN json_build_object(
    'success', true,
    'deducted', v_actual_deduction,
    'new_balance', v_new_balance
  );
END;
$$;
```

**Chargeback dialog flow:**
1. Admin clicks "Chargeback" on a user or transaction row
2. Dialog shows user info and current balance
3. Admin enters amount and mandatory reason
4. Clicks "Confirm Chargeback" -- calls `supabase.rpc("admin_chargeback", {...})`
5. On success: toast confirmation, close dialog, refresh data
6. On error: toast error message

**No new RLS policies needed** -- the function uses `SECURITY DEFINER` with an internal admin role check, same pattern as `transfer_money` and `record_transaction`.
