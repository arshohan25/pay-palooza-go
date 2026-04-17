

## Fix: Savings overview cards — count only active items

### Issue (confirmed in DB + code)

`src/components/SavingsFlow.tsx`:
- **Line 742** — `totalSaved = goals.reduce(...)` sums **all** statuses including withdrawn/cancelled.
- **Lines 758-759, 863-868** — "Saving Goals" tile uses `goals.length` and unfiltered totals.
- **Line 952** — "Your Goals (N)" header counts everything.

DB query confirmed: 1 active "Bike" + 1 withdrawn "Dream Bike" → tile incorrectly shows "2 active" and adds Dream Bike's ৳5,000 target to totals.

DPS tile already filters by `is_active` ✅. Gold/Stocks rows represent open positions only (sold quantities are deducted), so no fix needed there — but we should still confirm by scoping to `qty > 0`.

### Fix (single file: `src/components/SavingsFlow.tsx`)

Add one derived list near line 742 and reuse everywhere:

```ts
const activeGoals = goals.filter(g => g.status === "active");
const totalSaved = activeGoals.reduce((s, g) => s + Number(g.saved_amount), 0);
const totalGoalTarget = activeGoals.reduce((s, g) => s + Number(g.target_amount), 0);
```

Replace usages:
- **Header subtitle (757-759)**: use `activeGoals.length` and `totalSaved`.
- **Saving Goals tile (863-868)**: count → `activeGoals.length`; amounts → `activeGoals` reduces.
- **"Your Goals (N)" header (line 952)**: use `activeGoals.length` (the list itself already shows archived below via the sort-active-first logic added earlier — that stays).
- **Gold/Stocks tiles**: add safety filter `h.qty > 0` on holdings reduces (defensive — should already be true).

### What user sees after fix

- "Saving Goals" tile → **1 active** · ৳2,600 / ৳10,000 (Bike only)
- "Total Saved" header → ৳2,600 (excludes Dream Bike's withdrawn 0)
- "Your Goals (1)" header
- Withdrawn "Dream Bike" still appears in the list below active Bike (per prior 12-month archive logic)

### Files touched
- `src/components/SavingsFlow.tsx` only

### Out of scope
- DB changes (none needed — purely UI counting bug)
- Gold/Stocks logic (already correct)

