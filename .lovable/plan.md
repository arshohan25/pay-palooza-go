

## Plan: Session Timeout & Auto-Logout for Team Members

### What It Does
- Team members are automatically logged out after a configurable period of inactivity (default: 30 minutes)
- Admin can set the timeout duration from System Settings (e.g., 15 min, 30 min, 1 hour, 2 hours)
- A warning toast appears 2 minutes before logout
- Any user interaction (mouse, keyboard, touch, scroll) resets the timer

### Implementation

**1. Store timeout setting in `global_feature_toggles`**
- Use feature key `team_session_timeout_minutes` with the `description` field storing the numeric value (e.g., "30")
- No database migration needed — reuses existing config pattern from `AppConfigTab`

**2. Create `useSessionTimeout` hook** (`src/hooks/use-session-timeout.ts`)
- Reads `team_session_timeout_minutes` from `global_feature_toggles` on mount
- Checks if the current user is a team member (has `is_team_member` in auth metadata)
- Sets up activity listeners (`mousemove`, `keydown`, `touchstart`, `scroll`, `click`)
- Tracks last activity timestamp; on each tick (every 30s), checks if elapsed time exceeds threshold
- Shows a warning toast at 2 minutes remaining
- Calls `supabase.auth.signOut()` and redirects to `/team-login` when timeout is reached
- Updates `team_members.last_active_at` periodically (every 5 minutes) as a side effect

**3. Mount the hook in `AdminDashboard.tsx`**
- Call `useSessionTimeout()` inside the component so it runs for all team-authenticated admin sessions
- Also mount in agent/distributor/merchant dashboards if team members access those routes (via the existing `RoleGuard`)

**4. Add admin UI in `AdminSystemSettings.tsx` → App Config tab**
- Add a "Session Timeout" field with a dropdown: 15 min, 30 min, 1 hour, 2 hours, 4 hours
- Saves to `global_feature_toggles` with key `team_session_timeout_minutes`
- Audit-logged like other config changes

### Files Modified
- `src/hooks/use-session-timeout.ts` (new)
- `src/pages/AdminDashboard.tsx` — mount hook
- `src/components/admin/AdminSystemSettings.tsx` — add timeout config UI

