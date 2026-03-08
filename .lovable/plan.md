

## Send Team Credentials via Email on Account Creation

### Overview
Add an optional **email field** to the Add Team Member form. After account creation, automatically send the credentials (username, password, login URL) to that email using the existing Resend integration via a new edge function.

### Changes

#### 1. New Edge Function: `supabase/functions/send-team-credentials/index.ts`
- Accepts `{ email, displayName, username, password, loginUrl, role, department }`
- Uses the existing `RESEND_API_KEY` secret (already configured)
- Sends a formatted HTML email with:
  - Welcome message with display name
  - Username and password in a styled card
  - Login URL as a clickable button
  - Role and department info
  - "Change your password after first login" reminder
- CORS headers included, JWT verification disabled in config.toml

#### 2. Update `src/components/admin/AdminTeamManagement.tsx`
- Add `addEmail` state field (optional)
- Add email input to the Add Member form (between Display Name and Role)
- After successful account creation (`setCreatedCreds`), if email is provided:
  - Call `supabase.functions.invoke("send-team-credentials", { body: { ... } })`
  - Show toast: "Credentials sent to {email}"
- In the credentials-created view, show "✅ Credentials emailed to {email}" if sent
- Add a "Send via Email" button in the credentials view (for cases where email wasn't provided initially, or to resend)

#### 3. Update `supabase/config.toml`
- Add `[functions.send-team-credentials]` with `verify_jwt = false`

### Email Template (HTML)
```
Subject: Your EasyPay Team Account

Welcome to EasyPay, {displayName}!

Your team account has been created.

Username: {username}
Password: {password}
Role: {role}
Department: {department}

Login here: {loginUrl}

⚠️ Please change your password after your first login.
```

### Flow
1. Admin fills form (name, role, dept, optionally email)
2. Account created → credentials shown in dialog
3. If email provided → edge function sends email automatically
4. Admin can also click "Send via Email" button to (re)send manually

