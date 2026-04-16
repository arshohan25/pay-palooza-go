

# Add Initial Deposit to Goal Creation & Fix Realtime Sync

## Problem
1. Goal deposits don't sync instantly after creation
2. Goal creation flow lacks an initial deposit step — user should set target amount AND an initial first deposit amount

## Plan

### 1. Add "Initial Deposit" field to Create Goal screen
In `src/components/SavingsFlow.tsx`, add a new state `newInitialDeposit` (string, default `""`). Below the Target Amount card in the `step === "create"` section, add an "Initial Deposit (Optional)" card with amount input and quick-pick buttons (e.g. ৳100, ৳500, ৳1000, ৳2000, ৳5000). Validate that initial deposit does not exceed user balance.

### 2. Update Goal Review screen to show initial deposit
In the `step === "goal-review"` summary card, add an "Initial Deposit" row showing `৳{amount}` or "No initial deposit". Update the summary to be clearer about what will happen on confirmation.

### 3. Update `handleCreateGoal` to perform deposit after creation
After inserting the goal into `savings_goals`, if `newInitialDeposit > 0`:
- Call `supabase.rpc("savings_deposit", { p_goal_id: newGoalId, p_amount: initialAmt, p_source: "manual" })`
- Call `fetchBalance()` to sync wallet balance
- Show combined success toast

This requires changing the insert to use `.select("id").single()` to get the new goal ID.

### 4. Fix realtime sync
The realtime channel already listens to `savings_goals` and `savings_deposits` changes and calls `loadGoals()`. The issue is likely that `loadGoals()` is called but the UI doesn't reflect changes because the goal was just created locally. After `handleCreateGoal` succeeds, explicitly call `loadGoals()` (already done) and ensure `fetchBalance()` is called to update the wallet display.

### 5. Reset new state on navigation
Add `newInitialDeposit` to the `useEffect` that resets PIN/terms on step changes. Reset it when returning to home.

### File Changes
- **`src/components/SavingsFlow.tsx`** — All changes in this single file

