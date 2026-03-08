

## Plan: Team Password Reset + Onboarding Checklist

### 1. Database Migration
Add onboarding tracking columns to `team_members`:
- `has_logged_in` (boolean, default false) — set true on first login
- `has_changed_password` (boolean, default false) — set true after password change
- `has_completed_profile` (boolean, default false) — set true after profile setup
- `first_login_at` (timestamp, nullable)
- `password_changed_at` (timestamp, nullable)

### 2. Team Login Page (`src/pages/TeamLoginPage.tsx`)
After successful login:
- Check `team_members` for `has_logged_in`. If false, update to true + set `first_login_at`
- Check if `temp_password` exists and matches current password (or `has_changed_password` is false). If so, show a **forced password change dialog** before navigating to `/admin`

**Password Change Dialog:**
- Current password (pre-filled/hidden since they just logged in)
- New password + confirm new password (min 8 chars)
- Uses `supabase.auth.updateUser({ password: newPassword })`
- On success: update `team_members` set `has_changed_password = true`, `password_changed_at = now()`, clear `temp_password`

### 3. Onboarding Checklist Component (`src/components/admin/TeamOnboardingChecklist.tsx`)
New component shown at the top of the admin dashboard for team members who haven't completed all steps:
- Step 1: "First Login" — check mark if `has_logged_in`
- Step 2: "Change Password" — check mark if `has_changed_password`, otherwise "Change Now" button
- Step 3: "Complete Profile" — check mark if `has_completed_profile`, otherwise "Set Up" button (opens a mini form for display name / avatar)
- Progress bar showing X/3 complete
- Dismissible once all 3 are done

### 4. Admin Team Management (`src/components/admin/AdminTeamManagement.tsx`)
- Show onboarding status badges per team member in the table (e.g., "Onboarding: 2/3")
- Admin can see which steps each member has completed

### 5. Admin Dashboard Integration (`src/pages/AdminDashboard.tsx`)
- For team member sessions, fetch their `team_members` row
- If onboarding incomplete, render `TeamOnboardingChecklist` at top of dashboard

### Files Modified/Created
- **Migration**: Add 5 columns to `team_members`
- `src/pages/TeamLoginPage.tsx` — first login detection + forced password change
- `src/components/admin/TeamOnboardingChecklist.tsx` — new component
- `src/components/admin/AdminTeamManagement.tsx` — onboarding status display
- `src/pages/AdminDashboard.tsx` — render checklist for team members

