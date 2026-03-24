

## Plan: Add 2FA for Team Login

### Overview
After a team member enters correct username + password, they must verify a 6-digit OTP sent to their email before being granted access. This reuses the existing `send-email-otp` edge function and `otp_codes` table.

### Database Changes

**Add `email` column to `team_members` table** — required so we know where to send the 2FA code. Admins will set this when creating team members.

```sql
ALTER TABLE public.team_members ADD COLUMN email text;
```

### Edge Function Changes

**`send-email-otp`** — Add a new purpose `team_2fa` alongside the existing `email_verify`. No other changes needed since the function already handles send + verify flows generically via the `purpose` field. We'll pass `purpose: "team_2fa"` from the client.

### Frontend Changes

**`src/pages/TeamLoginPage.tsx`** — Add a 2FA step between password validation and redirect:

1. New state: `show2fa`, `otpCode`, `verifying2fa`, `teamEmail`
2. After successful `teamSignIn` and password-change check, fetch `team_members.email` for the logged-in user
3. If email exists, call `send-email-otp` with `{ email, purpose: "team_2fa" }` and show OTP dialog
4. OTP dialog: 6-digit input using existing `InputOTP` component, verify button, resend link
5. On successful verification, proceed to role-based redirect
6. If no email is set on the team member, skip 2FA (graceful fallback)

**`src/components/admin/AdminTeamManagement.tsx`** — Add an email field to the "Add Member" form (Step 1) so admins can set the 2FA email when creating members. Also allow editing it on existing members.

### Flow Diagram
```text
Username + Password
        │
        ▼
  Password OK? ──No──▶ Error
        │
       Yes
        │
        ▼
  Need password change? ──Yes──▶ Change dialog
        │                              │
       No                          Done
        │◄─────────────────────────────┘
        ▼
  Has email? ──No──▶ Skip 2FA → Redirect
        │
       Yes
        │
        ▼
  Send OTP to email
        │
        ▼
  Enter 6-digit code
        │
        ▼
  Verify via edge fn
        │
        ▼
  Redirect to dashboard
```

### Files Modified
- **Migration** — Add `email` column to `team_members`
- **`supabase/functions/send-email-otp/index.ts`** — Support `team_2fa` purpose
- **`src/pages/TeamLoginPage.tsx`** — Add 2FA OTP dialog step
- **`src/components/admin/AdminTeamManagement.tsx`** — Add email field to member creation/edit

