

# Add "Start DPS" Button + Real DPS System with Auto-Collection & Missed Payments

## Overview
Add a premium "Start a DPS" action button on the Savings tab home (matching the "Start a Goal" pattern on Goals tab). Implement real DPS behavior: auto-collect from balance on cycle date, track missed installments, allow repayment, and send 24h reminder notifications.

## Database Changes

### 1. Add columns to `savings_auto_save` table
```sql
ALTER TABLE savings_auto_save 
  ADD COLUMN missed_count integer DEFAULT 0,
  ADD COLUMN total_paid integer DEFAULT 0,
  ADD COLUMN total_installments integer DEFAULT 0,
  ADD COLUMN strategy text DEFAULT 'gold',
  ADD COLUMN last_missed_at timestamptz;
```
- `missed_count` — number of missed installments (insufficient balance)
- `total_paid` — installments successfully collected
- `total_installments` — total expected installments for the plan
- `strategy` — investment strategy (gold/mixed/stocks)
- `last_missed_at` — timestamp of last missed payment

### 2. Create `dps_missed_payments` table
```sql
CREATE TABLE public.dps_missed_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid REFERENCES savings_auto_save(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  due_date timestamptz NOT NULL,
  repaid boolean DEFAULT false,
  repaid_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE dps_missed_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own missed payments" ON dps_missed_payments
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
ALTER PUBLICATION supabase_realtime ADD TABLE public.dps_missed_payments;
```

## Frontend Changes (all in `src/components/SavingsFlow.tsx`)

### 3. Add "Start a DPS Plan" button on Savings Home
Below the existing "Start Auto-Save & Invest" button (or replacing it), add a premium gradient button:
- Icon: `CalendarClock` 
- Title: "Start a DPS Plan"
- Subtitle: "Auto-collect from wallet • Earn 2-5% profit"
- Clicking navigates to `step === "autosave"` (existing flow)

### 4. Add DPS installment tracker to active plan cards
In the existing auto-save plan cards (lines ~1282-1316), add:
- Progress indicator: "12/60 installments paid"
- Missed badge: "3 missed" with repay button
- Next collection date display

### 5. Add "Repay Missed" step
New `SavingsStep`: `"repay-missed"`
- Shows list of missed installments for a selected schedule
- User can select individual or all missed payments
- PIN confirmation + slide to repay
- Calls `savings_deposit` RPC for each repaid installment, marks `dps_missed_payments.repaid = true`

### 6. Compute `total_installments` on creation
When creating DPS, calculate total expected installments:
- Daily: `duration_months * 30`
- Weekly: `duration_months * 4`  
- Monthly: `duration_months`

Store in `savings_auto_save.total_installments` and set `strategy`.

## Edge Function Changes

### 7. Update `process-auto-save` to handle missed payments
In `supabase/functions/process-auto-save/index.ts`:
- When balance is insufficient, instead of just skipping:
  - Insert a record into `dps_missed_payments`
  - Increment `missed_count` on the schedule
  - Set `last_missed_at`
  - Still advance `next_run_at` to next cycle
- When balance is sufficient:
  - Increment `total_paid`
- Notification text updates for missed vs success

### 8. Create `dps-reminder` edge function
New `supabase/functions/dps-reminder/index.ts`:
- Queries all active schedules where `next_run_at` is within 24 hours
- Sends notification: "Your DPS installment of ৳{amount} is due tomorrow. Please ensure sufficient balance."
- Can be triggered by cron or manually

## Summary of Files
- **Migration SQL** — new table + columns
- **`src/components/SavingsFlow.tsx`** — DPS button, missed payment tracker, repay step
- **`supabase/functions/process-auto-save/index.ts`** — missed payment tracking
- **`supabase/functions/dps-reminder/index.ts`** — 24h reminder notifications (new)

