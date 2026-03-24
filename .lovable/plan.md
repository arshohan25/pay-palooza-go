

## Plan: Fix Team Member Creation (Session Hijack Bug) + Test Login Flow

### Problem Found
When an admin creates a new team member, the code calls `supabase.auth.signUp()` client-side. This **auto-signs in** as the new user, replacing the admin's session. Even though the code tries to restore the admin session afterward (lines 507-512), the `onAuthStateChange` listener fires first, causing the app to react to the new user's session — resulting in the admin being kicked to the onboarding screen.

### Root Cause
`signUp()` is a client-side operation that creates AND authenticates. The admin API (`auth.admin.createUser`) creates without authenticating, but it requires the service role key which cannot be used client-side.

### Solution
Create a new edge function `create-team-member` that handles account creation server-side using `auth.admin.createUser()`, then performs all the database inserts (profile, team_members, user_roles, permissions, audit_log) with a service-role client. The admin dashboard will call this function instead of `teamSignUp`.

### Changes

**1. New Edge Function: `supabase/functions/create-team-member/index.ts`**
- Verify caller has `admin` role (same pattern as `admin-reset-team-password`)
- Use `adminClient.auth.admin.createUser()` with `email_confirm: true` to create the user without triggering client-side auth
- Insert into `profiles`, `team_members`, `user_roles`, `team_access_permissions`, and `audit_logs`
- Return the new user ID and generated credentials

**2. Update `src/components/admin/AdminTeamManagement.tsx`**
- Replace the `teamSignUp()` call + manual DB inserts with a single `supabase.functions.invoke("create-team-member", { body: { ... } })` call
- Remove the session save/restore logic (no longer needed)
- Keep the existing UI flow (dialog, permissions step, success toast) unchanged

**3. Update `src/lib/auth.ts`**
- Keep `teamSignUp` and `usernameToEmail` exports (they're still used by `TeamLoginPage` for sign-in)
- Export `usernameToEmail` explicitly if not already (the edge function needs the same email pattern)

### Edge Function Payload
```typescript
{
  username: string,
  password: string,
  displayName: string,
  email?: string,
  role: string,
  department: string,
  notes?: string,
  permissions: Array<{
    section: string,
    can_view: boolean,
    can_add: boolean,
    can_edit: boolean,
    can_delete: boolean,
  }>
}
```

### Key Technical Details
- The edge function uses the same `@team.easypay.app` email domain pattern for synthetic emails
- `auth.admin.createUser({ email, password, email_confirm: true })` creates the user without sending a confirmation email and without affecting any client session
- All DB operations use the service-role client to bypass RLS
- The caller's admin role is verified via their JWT token

### Files Modified
- `supabase/functions/create-team-member/index.ts` — New edge function
- `src/components/admin/AdminTeamManagement.tsx` — Use edge function instead of client-side signUp

