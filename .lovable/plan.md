

## Plan: Admin Reset Team Password & Change Email

### What It Does
Adds two management actions to each team member card: **Reset Password** and **Change Email**. The admin can generate a new temporary password or update the 2FA email directly from the team management UI.

### Changes

**File: `src/components/admin/AdminTeamManagement.tsx`**

1. **Add state variables** for the reset password and change email dialogs:
   - `resetPwMember`, `newTempPassword`, `resettingPw` — for password reset dialog
   - `editEmailMember`, `newEmail`, `savingEmail` — for email change dialog

2. **Add two action buttons** to each member card (alongside the existing Shield, Activity, Trash buttons):
   - `KeyRound` icon button — opens Reset Password dialog
   - `Mail` icon button — opens Change Email dialog

3. **Reset Password dialog**:
   - Shows member name and a pre-generated random password (using existing `generatePassword()`)
   - Regenerate button to get a new random password
   - Confirm button calls the existing `admin-reset-pin` edge function pattern but adapted: since team members use username+password (not PIN), we need a new approach
   - Actually, team auth uses `supabase.auth.signInWithPassword` with real passwords, so resetting requires the admin API. We'll create a lightweight edge function `admin-reset-team-password` that uses `adminClient.auth.admin.updateUserById()` to set the new password
   - On success, shows the new password with copy button and option to email it via `send-team-credentials`
   - Records action in `audit_logs`

4. **Change Email dialog**:
   - Shows current email (from `team_members.email`) and an input for the new email
   - Save button updates `team_members.email` via direct Supabase update
   - Records action in `audit_logs`

**New file: `supabase/functions/admin-reset-team-password/index.ts`**

- Verifies caller has admin role (same pattern as `admin-reset-pin`)
- Accepts `{ targetUserId, newPassword }`
- Calls `adminClient.auth.admin.updateUserById(targetUserId, { password: newPassword })`
- Resets the `has_changed_password` flag on `team_members` so member is forced to change password on next login
- Records in `audit_logs`

### Technical Details

- The edge function reuses the exact auth verification pattern from `admin-reset-pin` (JWT validation, admin role check via service role client)
- Password reset also sets `team_members.has_changed_password = false` so the member must change it on next login
- Email change is a simple client-side update to `team_members.email` — no edge function needed
- Both actions are audit-logged with before/after details

### Files Modified
- `src/components/admin/AdminTeamManagement.tsx` — Add dialogs, buttons, handlers
- `supabase/functions/admin-reset-team-password/index.ts` — New edge function

