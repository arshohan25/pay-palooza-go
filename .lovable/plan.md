# Stop New User KYC Auto-Exemption

## Finding

After investigating the codebase and database:

- The `handle_new_user()` trigger does NOT set `kyc_exempt = true` — the column default is `false`
- There is no code that auto-exempts new users
- However, 3 users currently have `kyc_exempt = true`: your admin account (Shohan), one user (Abdur Rahman), and a newly created user (01613854293) — this last one was likely toggled manually via the admin panel

## Solution

1. **Reset the wrongly-exempted non-admin users** — Set `kyc_exempt = false` for users who aren't admins (using the data insert tool)
2. No code changes needed — the system already defaults to `kyc_exempt = false` for new signups

## Data Fix

```sql
UPDATE profiles SET kyc_exempt = false
WHERE kyc_exempt = true
AND user_id NOT IN (
  SELECT user_id FROM user_roles WHERE role = 'admin'
);
```

This will reset the 2 non-admin users (Abdur Rahman and 01680693484) while keeping the admin account exempt.

## Files Changed

- **No code changes** — only a data update to reset wrongly-exempted users