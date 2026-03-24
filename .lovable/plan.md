

## Plan: Fix Team Login Redirect Based on User Role

### Problem
Team members created via the admin panel are assigned roles like `compliance`, `support`, `operations`, etc. But `TeamLoginPage` always redirects to `/admin` after login, and the `RoleGuard` on `/admin` only allows users with the `admin` role. Result: team members get bounced to `/` (customer home).

### Solution
Two changes are needed:

**1. Update RoleGuard on `/admin` route to accept all team/staff roles**

In `src/App.tsx` (or wherever the `/admin` route is defined), expand the `roles` array on the admin RoleGuard to include all team-relevant roles: `admin`, `compliance`, `finance`, `support`, `operations`, `marketing`, `hr`, `audit`, `risk`, `developer`, `manager`.

**2. Add role-aware redirect in `TeamLoginPage`**

After successful login, check the user's roles and redirect to the appropriate dashboard:
- `admin` / team roles → `/admin`
- `agent` → `/agent`
- `merchant` → `/merchant`
- `distributor` → `/distributor`
- `super_distributor` → `/super-distributor`
- Fallback → `/admin` (since they logged in via team login)

### Files Modified
- `src/App.tsx` — Update the `roles` prop on the admin route's `RoleGuard`
- `src/pages/TeamLoginPage.tsx` — Add role-based redirect logic after login

### Technical Details
- Query `user_roles` table after login to determine the user's role
- The admin dashboard already has section-level permission enforcement via `team_access_permissions`, so allowing more roles into the route is safe -- users will only see sections they have permission for

