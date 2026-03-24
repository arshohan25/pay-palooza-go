

## Plan: Add Role-Based Session Timeout (Separate from Team Members)

### Problem
Currently, session timeout only applies to **team members** (admin staff). Regular users, agents, distributors, and merchants have no inactivity timeout.

### Solution
Create a new **user session timeout** system with its own configurable duration, separate from the team member timeout.

### Changes

**1. Admin UI — Add "User Session Timeout" dropdown** (`src/components/admin/AdminSystemSettings.tsx`)
- Add a second timeout card below the existing "Team Session Timeout" card
- Label: "User Session Timeout" with description "Auto-logout users, agents, distributors, and merchants after inactivity."
- Same time options (5m–8h), stored as `user_session_timeout_minutes` in `global_feature_toggles`
- Add state + save logic mirroring the team timeout pattern

**2. Create new hook** (`src/hooks/use-user-session-timeout.ts`)
- Similar structure to `use-session-timeout.ts` but for non-team-member authenticated users
- Reads `user_session_timeout_minutes` from `global_feature_toggles`
- Activates for any authenticated user who is **not** a team member (to avoid double-timeout)
- On expiry: signs out and redirects to `/` (home/auth page) instead of `/team-login`
- Same activity tracking (mousemove, keydown, etc.) and warning toast pattern
- Default: 30 minutes (if no config set)

**3. Wire hook into dashboards**
- `src/pages/Index.tsx` — add `useUserSessionTimeout()` (covers regular users)
- `src/pages/AgentDashboard.tsx` — add `useUserSessionTimeout()`
- `src/pages/DistributorDashboard.tsx` — add `useUserSessionTimeout()`
- `src/pages/MerchantDashboard.tsx` — add `useUserSessionTimeout()`
- `src/pages/SuperDistributorDashboard.tsx` — add `useUserSessionTimeout()`

### Key Difference from Team Timeout
| Aspect | Team Timeout | User Timeout |
|--------|-------------|-------------|
| Config key | `team_session_timeout_minutes` | `user_session_timeout_minutes` |
| Applies to | `is_team_member` metadata users | All authenticated non-team users |
| Redirect | `/team-login` | `/` |
| DB update | `team_members.last_active_at` | `profiles.updated_at` (skip) |

### Files Modified
- `src/components/admin/AdminSystemSettings.tsx` — add User Session Timeout config card
- `src/hooks/use-user-session-timeout.ts` — **new file**, inactivity hook for regular users
- `src/pages/Index.tsx` — wire hook
- `src/pages/AgentDashboard.tsx` — wire hook
- `src/pages/DistributorDashboard.tsx` — wire hook
- `src/pages/MerchantDashboard.tsx` — wire hook
- `src/pages/SuperDistributorDashboard.tsx` — wire hook

