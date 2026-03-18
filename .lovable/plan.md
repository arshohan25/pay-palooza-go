

## Recurring Donations Feature

### Overview
Add a "Recurring" tab to the Donations page where users can set up automatic monthly/weekly donations to their favorite causes. This follows the same proven pattern as the existing Auto-Save system (`savings_auto_save` table + `process-auto-save` edge function).

### Database Changes

**New table: `recurring_donations`**
- `id` uuid PK
- `user_id` uuid NOT NULL
- `cause_name` text NOT NULL
- `cause_icon` text
- `amount` numeric NOT NULL
- `frequency` text NOT NULL (weekly / monthly)
- `message` text
- `is_anonymous` boolean DEFAULT false
- `is_active` boolean DEFAULT true
- `next_run_at` timestamptz NOT NULL
- `last_run_at` timestamptz
- `created_at` / `updated_at` timestamptz

RLS: users can CRUD their own rows, admins can manage all.

### Edge Function: `process-recurring-donations`
Mirrors `process-auto-save` logic:
1. Query all active schedules where `next_run_at <= now()`
2. For each: check balance, call `record_transaction` RPC (type: payment), insert into `donations` table, calculate next run, notify user
3. If insufficient balance, insert a notification and skip

### UI Changes (`src/pages/DonationsPage.tsx`)

**New "Recurring" tab** (4th tab with a `RefreshCw` icon):
- Lists active recurring donation schedules with cause icon, amount, frequency, next run date
- Toggle switch to pause/resume each schedule
- Delete button to remove a schedule
- Empty state when no schedules exist

**Amount step enhancement**:
- Add a "Make this recurring" toggle below the anonymous toggle
- When enabled, show frequency selector (Weekly / Monthly)
- On PIN confirm: if recurring is enabled, create a `recurring_donations` row (with `next_run_at` set to frequency interval from now) AND process the first donation immediately as today's contribution

### Files to Create/Modify
1. **Migration SQL** — create `recurring_donations` table with RLS
2. **`supabase/functions/process-recurring-donations/index.ts`** — cron-triggered edge function
3. **`src/pages/DonationsPage.tsx`** — add Recurring tab, recurring toggle in amount step, schedule management UI

