

# Enforce Minimum Balance for DPS Opening (1st Installment Deposit)

## What Changes
When a user tries to open a new DPS, validate that their wallet balance covers at least 1 installment amount. The 1st installment is mandatory at opening time — block creation if balance is insufficient.

## Changes (single file: `src/components/SavingsFlow.tsx`)

### 1. Add balance check in "Continue to Review" button (line ~1476)
Currently only checks `autoAmtNum > 0`. Add: if `autoAmtNum > balance`, show error "Insufficient balance. You need at least ৳{amount} to open a DPS (1st installment is deposited immediately)."

### 2. Add balance check in `handleCreateAutoSave` (line ~412)
After validating amount, add: `if (amt > balance) { setError("Insufficient balance for 1st installment"); return; }`

### 3. Deduct 1st installment on creation (inside `handleCreateAutoSave`, after insert succeeds ~line 444)
- Call `recordTransaction()` or `supabase.rpc("savings_deposit")` to deduct the 1st installment amount from wallet
- Update `total_paid` to `1` in the insert (line 442) instead of `0`
- Refresh balance via `fetchBalance()`

### 4. Show balance indicator on the DPS create form
- Add `<AvailableBalanceBadge />` at the top of the `dps-create` step so users can see their current balance before selecting an amount
- Visually disable amount options that exceed the current balance (gray out + "Insufficient" label)

## Result
Users cannot open a DPS without sufficient funds. The 1st installment is collected immediately upon creation, matching real-world DPS behavior.

