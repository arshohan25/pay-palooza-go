

## Fix: Goal Detail header shows "0% complete / ৳5,000 remaining" on withdrawn goals

### Root cause confirmed (DB + code)

DB shows `Dream Bike` is `status='withdrawn'`, `saved_amount=0` — that's correct (funds already paid out to wallet). But `src/components/SavingsFlow.tsx` lines **1842-1866** render the same active-goal header for every status:
- "৳0 / ৳5,000" subtitle (line 1849)
- Progress bar at 0% (line 1857)
- "0% complete / ৳5,000 remaining" labels (lines 1860-1861)

We fixed the deposit form and the list card in earlier batches but missed this header. Also: this goal's `withdrawn_at`/`withdrawn_amount` are NULL because it was withdrawn **before** those columns existed → backfill needed for the new layout to show the payout date/amount.

### Fix

**1. `src/components/SavingsFlow.tsx`** (Goal Detail header, lines ~1842-1866) — branch by status:

```tsx
const isWithdrawn = selectedGoal.status === "withdrawn";
const savedNum = Number(selectedGoal.saved_amount);
const targetNum = Number(selectedGoal.target_amount);
const isCompleted = !isWithdrawn && (selectedGoal.status === "completed" || (targetNum > 0 && savedNum >= targetNum));
const wAmount = Number((selectedGoal as any).withdrawn_amount ?? 0);
const wAt = (selectedGoal as any).withdrawn_at ? new Date((selectedGoal as any).withdrawn_at) : null;

// Header card:
{isWithdrawn ? (
  // Archived layout — no progress bar, no "remaining"
  <>
    <subtitle>Goal achieved & withdrawn</subtitle>
    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-[14px] p-3 text-center">
      <p>✓ Withdrawn ৳{(wAmount || targetNum).toLocaleString()}</p>
      {wAt && <p className="text-[11px] text-muted-foreground">on {wAt.toLocaleDateString("en-BD",{month:"short",day:"numeric",year:"numeric"})}</p>}
    </div>
  </>
) : isCompleted ? (
  // 100% gold bar + "Goal achieved 🎉" — no "remaining"
  <full-bar /> <p>100% complete 🎉</p> <p>Ready to withdraw</p>
) : (
  // Existing active layout (unchanged)
  <progress + "X% complete / ৳Y remaining" />
)}
```

Subtitle (line 1849) also needs `isWithdrawn` branch: instead of "৳0 / ৳5,000", show "Goal of ৳5,000 • Closed".

**2. Migration — backfill the legacy `Dream Bike` row** so the new UI has data to display:

```sql
UPDATE savings_goals
SET withdrawn_at = COALESCE(withdrawn_at, updated_at, created_at),
    withdrawn_amount = COALESCE(withdrawn_amount, target_amount)
WHERE status = 'withdrawn'
  AND (withdrawn_at IS NULL OR withdrawn_amount IS NULL);
```

(Uses `target_amount` as best-effort — for `Dream Bike` that's ৳5,000, which is what the user actually withdrew.)

### What user sees after fix

Opening the withdrawn `Dream Bike` goal:
- **Header**: 🏍️ Dream Bike · "Goal of ৳5,000 • Closed"
- **Green pill**: "✓ Withdrawn ৳5,000 on Apr 17, 2026"
- **No progress bar, no "0% complete", no "remaining"**
- **Deposit history timeline** stays (already works)
- **No deposit form below** (already fixed in prior batch)

### Files touched
- `src/components/SavingsFlow.tsx` — Goal Detail header status-branch
- New migration — backfill `withdrawn_at`/`withdrawn_amount` for legacy withdrawn goals

### Out of scope
- No changes to active/completed flow (only withdrawn breaks)
- No DPS / Gold / Stocks / Loan changes (Batch 2 territory)

