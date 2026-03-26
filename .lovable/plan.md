

# Fix: Users Can Self-Exempt from KYC

## Problem
The `kyc_exempt` field on the `profiles` table is **not protected** by the `protect_profile_fields` trigger. Any authenticated user can call `supabase.from("profiles").update({ kyc_exempt: true })` from the browser console and bypass KYC verification entirely.

**Evidence**: 8 out of 10 users have `kyc_exempt = true`, but audit logs only show admin-granted exemptions for 2 users. The newest user (created today) is already exempt with no audit trail.

## Root Cause
The `protect_profile_fields` trigger guards `balance`, `phone`, `user_id`, and `status` — but omits `kyc_exempt`. This is a privilege escalation vulnerability.

## Fix

### 1. Database migration — protect `kyc_exempt` in trigger
Add `kyc_exempt` to the `protect_profile_fields` trigger so only service_role/admin can change it:

```sql
-- Add kyc_exempt protection
IF NEW.kyc_exempt IS DISTINCT FROM OLD.kyc_exempt THEN
  IF current_user NOT IN ('postgres', 'supabase_admin')
     AND current_setting('role') NOT IN ('service_role', 'rls_none') THEN
    NEW.kyc_exempt := OLD.kyc_exempt;
  END IF;
END IF;
```

### 2. Database migration — reset wrongly exempted users
Reset all non-admin users who shouldn't be exempt:

```sql
UPDATE profiles SET kyc_exempt = false
WHERE kyc_exempt = true
AND user_id NOT IN (
  SELECT user_id FROM user_roles WHERE role = 'admin'
);
```

### 3. Admin Dashboard — use service-role RPC
The admin toggle in `AdminDashboard.tsx` currently uses the client-side Supabase call which runs as `authenticated` role — after the trigger fix, admins won't be able to toggle exemptions either. Create an RPC function with `SECURITY DEFINER` that the admin can call:

```sql
CREATE OR REPLACE FUNCTION set_kyc_exempt(target_user_id uuid, exempt boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE profiles SET kyc_exempt = exempt WHERE user_id = target_user_id;
END;
$$;
```

Then update the admin toggle in `AdminDashboard.tsx` to call `supabase.rpc('set_kyc_exempt', { target_user_id, exempt })` instead of a direct `.update()`.

## Summary
- 1 database migration (trigger update + data reset + new RPC)
- 1 file edit (`AdminDashboard.tsx` — use RPC for toggle)

