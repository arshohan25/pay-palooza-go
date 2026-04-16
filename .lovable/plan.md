

# Goal & DPS Detail Views with Vertical Timeline

## What We're Building
When a user taps a goal card (e.g. "Dream Bike") or a DPS plan card, they'll see a premium detail view featuring:
- A **vertical alternating timeline** showing all deposit dates and amounts (left/right zigzag pattern)
- **Goal detail**: deposit field + PIN at the bottom to add money directly
- **DPS detail**: next installment date, total deposited amount, and repay button for missed payments

## Changes (all in `src/components/SavingsFlow.tsx`)

### 1. Add new steps to SavingsStep type
Add `"goal-detail"` and `"dps-detail"` to the union type.

### 2. Fetch deposit history for selected goal/schedule
Add state: `goalDeposits` (array of `{id, amount, source, created_at}`). When entering goal-detail or dps-detail, query `savings_deposits` filtered by `goal_id` (for goals) or query `dps_missed_payments` + infer paid installments from schedule data for DPS. Sort by date ascending.

### 3. Goal Detail View (`step === "goal-detail"`)
- **Header**: Goal emoji, name, progress bar, saved/target amounts
- **Vertical Timeline**: A centered vertical line with deposits alternating left/right. Each node shows:
  - Date (formatted short)
  - Amount (৳X,XXX)
  - Source badge (manual / auto / dps_repay)
  - Connected by a dotted vertical line with circle markers
- **Deposit Section** at bottom: Amount input with presets, PIN input, slide-to-confirm (reuses existing `handleSave` logic)

### 4. DPS Detail View (`step === "dps-detail"`)
- **Header**: Strategy icon, frequency, amount per installment
- **Summary cards**: Total Deposited, Next Installment Date, Installments Paid/Total, Missed count
- **Vertical Timeline**: Same alternating pattern showing each paid/missed installment with status indicators (green check for paid, red alert for missed)
- **Repay button** if missed payments exist

### 5. Navigation updates
- Goal card's `ChevronRight` and name click → `setStep("goal-detail")` instead of `"add"`
- DPS plan cards get a tap handler → `setStep("dps-detail")` with selected schedule stored in new state `selectedSchedule`
- Back buttons on both detail views return to respective home tabs

### Technical Details
- Query: `supabase.from("savings_deposits").select("*").eq("goal_id", goalId).order("created_at", { ascending: true })`
- For DPS timeline, combine `savings_deposits` (source = "auto" or "dps_repay") with `dps_missed_payments` into a unified sorted list
- Timeline uses Framer Motion staggered animations
- Premium glassmorphism cards with gradient accents matching existing design patterns

