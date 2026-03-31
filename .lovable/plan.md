

# Filter Out Non-Regular Users from Performance Tracker

## Problem
The User Performance Tracker shows staff members (staff-*), agents, merchants, distributors, and super distributors alongside regular users. Only regular "user" role accounts should appear.

## Solution

### 1. Update the `get_user_performance_stats` RPC (database migration)
Add a filter to exclude:
- Staff accounts (phone starts with `staff-`)
- Users who have any non-user role (agent, merchant, distributor, super_distributor, admin, etc.)

```sql
CREATE OR REPLACE FUNCTION public.get_user_performance_stats()
...
  FROM profiles p
  WHERE p.phone NOT LIKE 'staff-%'
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = p.user_id
        AND ur.role NOT IN ('user')
    )
  ...
```

This filters at the database level so the frontend receives only regular consumer users.

### 2. Add client-side safety filter (AdminUserPerformanceTracker.tsx)
In `fetchData`, after setting users, also filter out any `staff-` prefixed phones as a fallback:
```ts
setUsers((perfData as UserPerf[])?.filter(u => !u.phone?.startsWith("staff-")) ?? []);
```

## Files Changed
- **New migration** — Update `get_user_performance_stats` function to exclude staff/agent/merchant/distributor/SD
- `src/components/admin/AdminUserPerformanceTracker.tsx` — Client-side safety filter

