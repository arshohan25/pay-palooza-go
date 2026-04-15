

# Enforce 3-Month Lock-in, 1–2% Early Cancellation Penalty & Marketing Text

## Problem
Currently, savings goals can be deleted anytime with no lock-in enforcement or penalty. The `DURATION_OPTIONS` have high penalty percentages (0.5%–5%) and varying lock-in periods. User wants:
1. **3-month minimum lock-in** — cannot cancel at all before 3 months
2. **1–2% early cancellation penalty** based on amount (before the selected duration ends)
3. **Marketing/motivational text** encouraging users to complete their goal and withdraw with profit

## Changes

### 1. Update `DURATION_OPTIONS` penalties (`SavingsFlow.tsx`)
Change all `penaltyPct` values to **1–2%** range and set `minLock` to **3** months for all durations:

| Duration | minLock | penaltyPct |
|----------|---------|------------|
| 6m       | 3       | 2%         |
| 1y       | 3       | 1.5%       |
| 2y       | 3       | 1.5%       |
| 3y       | 3       | 1%         |
| 5y       | 3       | 1%         |
| 10y      | 3       | 1%         |

### 2. Block deletion within 3 months (`handleDeleteGoal`)
- Check `goal.created_at` — if less than 3 months old, show error toast "Cannot cancel before 3-month lock-in period" and prevent deletion
- If between 3 months and goal end date, show penalty warning in the delete confirmation sheet (e.g. "A 2% penalty (৳X) will be deducted from your saved amount")
- If past the goal duration, no penalty

### 3. Update delete confirmation UI
- Show lock-in status and penalty amount in the delete sheet
- Display calculated penalty: `saved_amount × penaltyPct / 100`
- Change button text to "Cancel Goal (৳X penalty)" when applicable

### 4. Add marketing/motivational text
- On each goal card: add a subtle motivational line like "Complete your goal & withdraw with profit! 💰"
- In the Early Cancellation Policy box: add positive text like "Stay invested to earn up to X% profit. Complete your goal and withdraw your full savings + profit!"
- In the delete confirmation: add "You're X% towards your goal! Stay invested to earn ৳Y in profit"

### 5. Update Terms & Conditions section
- Update the "Early Cancellation" section in terms to reflect the new 1–2% penalty and universal 3-month lock-in

### Files Modified
- `src/components/SavingsFlow.tsx` — All changes in one file

