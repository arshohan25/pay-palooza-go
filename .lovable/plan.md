

## Plan: Fix KYC Exempt Toggle Auto-Reverting

### Root Cause
The `profiles` table has an UPDATE RLS policy that only allows users to update **their own** profile (`auth.uid() = user_id`). There is **no admin UPDATE policy** on profiles. When an admin toggles KYC exempt for another user, the database silently ignores the update (0 rows affected, no error), but the UI optimistically shows success. On any data refresh, the toggle reverts to OFF.

### Fix

**1. Database Migration** — Add an RLS policy allowing admins to update any profile:

```sql
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
```

This is the only change needed. No code changes required — the existing toggle logic in `AdminDashboard.tsx` is correct; it just needs the database to actually accept the write.

### Files Modified
- Database migration (new policy on `profiles` table)

