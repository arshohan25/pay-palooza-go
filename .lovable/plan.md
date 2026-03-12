

## Real-Time Savings System with Auto-Save & Admin Dashboard

### Current State
The savings flow is entirely local — hardcoded goals, no database persistence, no real balance deductions. It needs to become a fully functional, real-time, database-backed feature.

### Database Changes (3 new tables)

**`savings_goals`** — User savings goals
- `id`, `user_id`, `name`, `emoji`, `target_amount`, `saved_amount` (default 0), `status` (active/completed/cancelled), `created_at`, `updated_at`
- RLS: Users manage own goals; admins read all

**`savings_deposits`** — Individual deposit records (audit trail)
- `id`, `goal_id`, `user_id`, `amount`, `source` (manual/auto), `created_at`
- RLS: Users read own; admins read all

**`savings_auto_save`** — Auto-save schedules
- `id`, `user_id`, `goal_id` (nullable — can go to default goal), `frequency` (daily/weekly/monthly), `amount`, `is_active` (default true), `next_run_at`, `last_run_at`, `created_at`, `updated_at`
- RLS: Users manage own; admins read all

Enable realtime on `savings_goals` and `savings_deposits`.

**New RPC: `savings_deposit`** — Atomically deducts from wallet balance, credits to goal's `saved_amount`, inserts deposit record, returns new balances. Prevents overdraft.

### SavingsFlow Rewrite (`src/components/SavingsFlow.tsx`)

**Home screen:**
- Fetch goals from `savings_goals` table with real-time subscription
- Show total saved across all goals, individual goal cards with progress
- "Create Goal" button — name, emoji picker, target amount
- Delete/cancel goal option

**Add to Goal screen:**
- Goal selector (existing dropdown)
- Amount: preset chips (৳100, ৳200, ৳500, ৳1000, ৳5000) + custom input
- Calls `savings_deposit` RPC for real balance deduction
- Success confetti on goal completion

**Auto-Save tab (new):**
- Dropdown: Daily / Weekly / Monthly frequency
- Amount: ৳100, ৳200, ৳500, ৳1000, ৳5000, or Custom
- Link to a specific goal or "General Savings"
- Toggle on/off per schedule
- Shows next scheduled date

### Edge Function: `process-auto-save` (new)
- Called by pg_cron daily
- Queries all active `savings_auto_save` where `next_run_at <= now()`
- For each: calls `savings_deposit` RPC, updates `next_run_at` based on frequency
- Skips if insufficient balance (creates a notification instead)

### Admin Dashboard — Savings Tab

**`src/pages/AdminDashboard.tsx`:**
- Add "Savings" nav item with `PiggyBank` icon
- New `AdminSavingsManagement` component showing:
  - Total platform savings (sum of all goals)
  - Active auto-save schedules count
  - User savings table: user name/phone, total saved, goal count, auto-save status
  - Click user → detail sheet with their goals, deposits history, auto-save config
  - Search/filter by user

### Files

1. **Migration SQL** — 3 tables + `savings_deposit` RPC + realtime
2. **`src/components/SavingsFlow.tsx`** — Full rewrite with DB-backed goals, deposits, auto-save config
3. **`supabase/functions/process-auto-save/index.ts`** — Auto-save cron processor
4. **`src/components/admin/AdminSavingsManagement.tsx`** — New admin component
5. **`src/pages/AdminDashboard.tsx`** — Add savings nav + tab
6. **`src/hooks/use-admin.ts`** — Add savings fetch helpers

