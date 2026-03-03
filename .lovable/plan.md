

## Plan: Auto-Purge Cron Job + User Detail Drawer

### 1. Auto-Purge Edge Function + Cron Job

**New file: `supabase/functions/auto-purge-deactivated/index.ts`**
- Edge function that queries `profiles` where `status = 'deactivated'` AND `scheduled_deletion_at < now()`
- For each expired user, reuses the same cascading delete logic from `delete-user` (delete from 20+ tables, then `auth.admin.deleteUser`)
- Logs each purge in `audit_logs` with action `auto_purge_user`
- Uses service role key (no JWT needed)
- Returns count of purged users

**Config:** Add `[functions.auto-purge-deactivated]` with `verify_jwt = false` to `supabase/config.toml`

**Cron job:** Enable `pg_cron` + `pg_net` extensions, then schedule a daily cron (runs at midnight UTC) that calls the edge function via `net.http_post`

### 2. User Detail Drawer

**Modified: `src/pages/AdminDashboard.tsx`**
- Add state `detailUser` to track which user's drawer is open
- Add a clickable row or "View" button on each user row to open the drawer
- Use a `Sheet` (already imported) as the drawer container

**Drawer content sections:**
1. **Profile header** — avatar, name, phone, email, status badge, balance, referral code, created_at
2. **Roles** — fetch from `user_roles` table for the user, show as badges
3. **KYC Status** — fetch from `kyc_verifications`, show status, NID number, face match score, reviewer notes
4. **Recent Transactions** — fetch last 10 from `transactions` for the user, show type/amount/date/status in a mini table
5. **Account timeline** — deactivated_at, scheduled_deletion_at if applicable

**New helper in `src/hooks/use-admin.ts`:**
- `fetchUserDetails(userId)` — parallel fetch of profile, roles, KYC, and recent transactions for a single user

### Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/auto-purge-deactivated/index.ts` | New edge function |
| `supabase/config.toml` | Add function config |
| `src/pages/AdminDashboard.tsx` | Add user detail drawer with View button |
| `src/hooks/use-admin.ts` | Add `fetchUserDetails` helper |
| SQL (via insert tool) | Enable pg_cron/pg_net extensions + schedule daily job |

