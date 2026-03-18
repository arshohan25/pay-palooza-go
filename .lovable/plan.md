

## Fix: Route Donation Funds to Treasury

### Problem
Currently, donations deduct from the user's wallet via `record_transaction` (type "payment"), but the money disappears — it's not credited to any recipient. The `donations` table logs the record, but there's no financial destination.

### Solution
Route donation funds to the **platform treasury** as a "donation_received" entry. This mirrors how other platform revenues (fees, commissions) flow into the treasury, and gives the admin full visibility over collected donation funds.

### Changes

**1. Database Migration — New treasury ledger type**
- Add a trigger or update the `record_transaction` flow isn't needed here. Instead, after the `record_transaction` RPC succeeds, call `treasury_debit_for_addmoney` in reverse — credit the treasury with the donation amount.
- Better approach: Create a new RPC `process_donation` that atomically:
  - Deducts from user balance (with row lock)
  - Credits platform treasury
  - Inserts treasury_ledger entry with type `donation_received`
  - Inserts the transaction record
  - Inserts into `donations` table
  - Optionally sets up recurring schedule
- This replaces the current two-step approach (RPC + separate insert) with a single atomic operation.

**2. New RPC: `process_donation`** (SQL migration)
- Parameters: `p_amount`, `p_cause_name`, `p_cause_icon`, `p_message`, `p_is_anonymous`, `p_is_recurring`, `p_frequency`
- Logic:
  - Lock user balance, verify sufficient funds
  - Deduct from user
  - Credit treasury balance, insert treasury_ledger row (type: `donation_received`, description: cause name)
  - Insert transaction (type: `payment`, reference: `DON-{cause}`)
  - Insert into `donations` table
  - If recurring, insert into `recurring_donations`
- Returns: `{ success, new_balance }`

**3. Update `src/pages/DonationsPage.tsx`**
- Replace the current `handlePinSubmit` logic (lines 107-126) that calls `record_transaction` + separate `donations.insert` + separate `recurring_donations.insert` with a single call to the new `process_donation` RPC.

**4. Update `process-recurring-donations` Edge Function**
- Currently it manually deducts balance and inserts transaction/donation records without crediting treasury.
- Add treasury credit logic: after deducting user balance, also credit the platform treasury and insert a treasury_ledger entry.

### Files
- **New migration**: Create `process_donation` RPC
- **Modified**: `src/pages/DonationsPage.tsx` — use new RPC in `handlePinSubmit`
- **Modified**: `supabase/functions/process-recurring-donations/index.ts` — add treasury credit

