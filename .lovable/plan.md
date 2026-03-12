

## Add Duration to Auto-Save with Auto-Settlement

### What We're Building
Add a **duration selector** to auto-save schedules so they automatically stop after a set period (6 months, 1 year, 2 years, 3 years, 5 years, 10 years). When the end date arrives, the schedule deactivates and the user is notified.

### Database Changes

**Add columns to `savings_auto_save`:**
- `duration` (text, nullable) — e.g. `6m`, `1y`, `2y`, `3y`, `5y`, `10y`
- `ends_at` (timestamptz, nullable) — calculated from created_at + duration
- `settled` (boolean, default false) — marks if auto-settled after completion

### Code Changes

**`src/components/SavingsFlow.tsx`:**
- Add duration dropdown in auto-save form: 6 Months, 1 Year, 2 Year, 3 Year, 5 Year, 10 Year
- Calculate `ends_at` from current date + selected duration on create
- Show end date and remaining time on each schedule card
- Show "Completed" badge for settled schedules

**`supabase/functions/process-auto-save/index.ts`:**
- Before processing each schedule, check if `ends_at` is reached
- If expired: set `is_active = false`, `settled = true`, skip processing, notify user with "Auto-save completed" notification

**`src/components/admin/AdminSavingsManagement.tsx`:**
- Show duration and end date in auto-save schedule details

### Files
1. Migration SQL — 3 new columns on `savings_auto_save`
2. `src/components/SavingsFlow.tsx` — Duration selector UI + end date display
3. `supabase/functions/process-auto-save/index.ts` — Auto-settlement logic
4. `src/components/admin/AdminSavingsManagement.tsx` — Show duration info

