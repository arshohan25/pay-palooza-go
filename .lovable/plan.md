## Issues

**1. "Total Deposited ৳0" ignores the opening deposit**

The summary card at the top of the DPS detail screen computes:

```
totalDeposited = schedule.total_paid * schedule.amount
```

`total_paid` is the cron‑run counter, which is `0` until the first scheduled installment runs. The ৳1,000 debited at plan creation (the "opening deposit") never increments `total_paid`, so the card shows ৳0 even though the timeline already lists the opening deposit and the reconciliation card already accounts for it.

**2. "Collect Now" debits the wallet without a PIN**

The Collect Now button on the DPS detail screen invokes the `process-auto-save` edge function directly on tap. Every other money‑moving action in this flow (create plan, repay missed, delete, withdraw, etc.) routes through `SavingsPinInput` + `verifyPin()` + `SlideToConfirm`. Collect Now is the only debit path that skips this.

## Fix

### A. Total Deposited reflects actual money in the goal

In the DPS detail header (around line 2357‑2360 of `src/components/SavingsFlow.tsx`):

- Derive `totalDeposited` from the same bucketed timeline used by the reconciliation card: `processedSum + repaidSum + openingSum − refundedSum` (i.e. money that currently sits in the linked goal).
- Lift the timeline bucketing (currently inside the timeline IIFE at ~line 2476) into the parent `dps-detail` scope, or compute a lightweight `netDeposited` from `dpsTimeline` once and reuse it in both the header card and the reconciliation card so the two never disagree.
- Keep the `Installments` tile as `paid / totalInst` (cron count) — that semantic is correct; only the money figure changes.

### B. Collect Now goes through PIN verification

Add a new flow step `collect-now` and route the button to it instead of calling the edge function directly:

1. Add `"collect-now"` to the `step` union and to the back‑button handler (line ~857) so it returns to `dps-detail`.
2. Change the Collect Now button (line ~2439) to `setStep("collect-now"); setPin(""); setPinError("");` instead of invoking the function.
3. Add a new step view rendered when `step === "collect-now"` containing:
   - A summary card: schedule amount, linked goal, current wallet balance, and a warning if `balance < amount` ("Insufficient balance — this run will be marked missed").
   - `SavingsPinInput` bound to the existing `pin` / `pinError` state.
   - `SlideToConfirm` that calls a new `handleCollectNow()` handler.
4. `handleCollectNow()`:
   - `await verifyPin(pin)` — on failure call `failPin()` and return.
   - Set `processing`, then invoke `supabase.functions.invoke("process-auto-save", { body: { schedule_id: selectedSchedule.id } })`.
   - Map the existing outcome codes (`collected`, `missed`, `dedup_skipped`, `settled`, `no_goal`) to the same toasts already used inline today.
   - On success: refresh `loadAutoSaves / loadMissedPayments / loadGoals`, clear PIN, return to `dps-detail`.
   - On error: show error inline (`setError`) and keep the user on the PIN screen.

No backend / RLS changes needed — `process-auto-save` already runs against the authenticated user; this only adds a client‑side PIN gate to match every other debit flow.

### Files touched

- `src/components/SavingsFlow.tsx` (only)
