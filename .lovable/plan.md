

## Team Member Account Creation with Username/Password & Separate Login

### Overview
Replace the current "search existing user by phone" team member flow with a proper username/password account creation system. Admin auto-generates or chooses unique credentials. Team members log in via a dedicated `/team-login` page, separate from the main admin's phone+PIN auth.

### Database Changes

**1. Add columns to `team_members` table:**
- `username` (text, unique, not null) — unique login identifier
- `temp_password` (text, nullable) — shown once to admin after creation, cleared after first login (or kept for reference)

**Migration SQL:**
```sql
ALTER TABLE public.team_members 
  ADD COLUMN IF NOT EXISTS username text UNIQUE,
  ADD COLUMN IF NOT EXISTS temp_password text;
```

No new tables needed — team members still get Supabase Auth accounts (email = `{username}@team.easypay.local`, password = chosen/generated). The `username` column on `team_members` is for display and lookup.

### Code Changes

**2. `src/lib/auth.ts` — Add team auth helpers:**
- `teamSignUp(username, password, displayName)` — creates auth account with email `{username}@team.easypay.local`
- `teamSignIn(username, password)` — signs in using the same pattern
- Helper to generate random username (e.g., `staff-XXXX`) and password (8-char alphanumeric)

**3. `src/components/admin/AdminTeamManagement.tsx` — Revamp "Add Member" dialog:**
- Remove phone search flow entirely
- New form fields: Username (auto-generated with edit option), Password (auto-generated with edit option), Display Name, Role, Department, Notes
- On submit: call `teamSignUp`, create profile, assign role, insert `team_members` row with username
- Show credentials card after creation (copyable username + password)

**4. `src/pages/TeamLoginPage.tsx` — New page:**
- Clean login form with Username + Password fields
- Calls `teamSignIn(username, password)`
- On success, redirects to `/admin` (RoleGuard handles access based on their role)
- Branded with EasyPay logo, distinct from the main user auth page

**5. `src/App.tsx` — Add route:**
- `/team-login` → `<TeamLoginPage />` (public, no RoleGuard)

**6. Profile creation for team members:**
- During `teamSignUp`, create a `profiles` row with a synthetic phone (e.g., `TEAM-{username}`) so existing queries don't break
- The team member's `user_id` links everything together as before

### Login Flow Summary
- **Main admin**: continues using `/` → phone + PIN auth → `/admin`
- **Team members**: use `/team-login` → username + password → `/admin` (access controlled by their `team_access_permissions`)

### Credential Display
After creation, admin sees a one-time credential card:
- Username: `staff-A7K2` (copyable)
- Password: `xP9mK2nQ` (copyable)  
- Message: "Share these credentials securely. The member can change their password after first login."

