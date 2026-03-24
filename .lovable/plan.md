

## Plan: Fix AdminDashboard Rejecting Non-Admin Team Roles

### Problem
The `AdminDashboard` component (line 626) has its own authorization check using `useAdmin()`, which only looks for the `admin` role. This creates a double-gate:
1. **RoleGuard** (in App.tsx) -- correctly allows all 11 team roles including `compliance`
2. **AdminDashboard** (internal) -- uses `useAdmin()` which only checks `role = 'admin'`, bouncing all other team roles to `/`

The RoleGuard was fixed earlier, but the dashboard's internal check was missed.

### Solution
Update `useAdmin()` hook to check for any team role, not just `admin`. Rename the concept slightly to `isTeamAdmin` or keep `isAdmin` but broaden it to match the same set of roles the RoleGuard allows.

**File: `src/hooks/use-admin.ts`**

Change the `useAdmin` hook to query for any of the 11 team roles instead of only `admin`:

```typescript
// Before:
.eq("role", "admin")
.maybeSingle();
setIsAdmin(!!data);

// After:
.in("role", ["admin","compliance","finance","support","operations","marketing","hr","audit","risk","developer","manager"]);
setIsAdmin((data?.length ?? 0) > 0);
```

This single change fixes:
- Dashboard redirect at line 626
- All `if (!isAdmin) return;` guards on data fetching (lines 522, 536, etc.)
- The `if (!isAdmin) return null;` at line 769

No other files need changes. The section-level `team_access_permissions` system already handles granular access within the dashboard.

### Files Modified
- `src/hooks/use-admin.ts` -- Broaden role check from `admin` only to all team roles

