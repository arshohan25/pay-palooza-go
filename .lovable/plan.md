

## Trash System for Deleted Users

Currently, when a user is deleted (hard delete), all their data is permanently removed from every table. The user wants deleted users' data to be preserved in a "trash" so admins can still view their profile, transactions, and activity history after deletion.

### Approach

Instead of cascading deletes across all tables, we archive the user's data into a new `deleted_users` table before removing them from `profiles` and `auth.users`. The admin dashboard gets a new "Trash" tab to browse and inspect deleted users.

### Database Changes

**New table: `deleted_users`**
- `id` (uuid, PK)
- `user_id` (uuid) — original user ID
- `name`, `phone`, `avatar_url` — profile snapshot
- `balance_at_deletion` (numeric)
- `profile_data` (jsonb) — full profile row snapshot
- `transactions` (jsonb) — all user transactions
- `roles` (jsonb) — user roles at time of deletion
- `kyc_data` (jsonb) — KYC verification records
- `notifications` (jsonb) — notifications history
- `support_conversations` (jsonb) — support chat history
- `referrals` (jsonb) — referral data
- `other_data` (jsonb) — catch-all for remaining table data (agents, merchants, orders, etc.)
- `deleted_by` (uuid) — admin who deleted
- `deleted_at` (timestamptz, default now())
- `deletion_reason` (text, nullable)
- `balance_recovered` (numeric, default 0)

RLS: Only admins can read. No client writes (edge function uses service role).

### Edge Function Changes

**`delete-user/index.ts`** — Before cascading deletes, snapshot all user data into `deleted_users`:
1. Query all related tables for the user
2. Insert a single archive row into `deleted_users` with JSON snapshots
3. Proceed with existing delete logic

**`auto-purge-deactivated/index.ts`** — Same archival step before purging expired users.

### Admin Dashboard Changes

**`src/pages/AdminDashboard.tsx`**:
- Add "Trash" nav item (with `Trash2` icon)
- New trash tab showing a list of deleted users with name, phone, deletion date, deleted-by info
- Click a trashed user to open a detail sheet showing their archived profile, transaction history, roles, KYC data, and other activity — all read from the `deleted_users` JSONB columns

**`src/hooks/use-admin.ts`**:
- Add `fetchDeletedUsers()` function to query `deleted_users` table
- Add `fetchDeletedUserDetail(id)` to get full archived record

### Summary

- 1 new database table (`deleted_users`)
- 2 edge functions updated (archive before delete)
- Admin dashboard gets a "Trash" tab with full read-only access to deleted user data
- No data is lost on deletion anymore

