

## Add Deposit Account Numbers to Add Money Flow

### Problem
When users select a source (e.g., bKash, Nagad), they don't see where to send money. They need to know the admin-configured destination number/account before they can transfer and upload proof.

### Solution
1. **New DB table**: `deposit_accounts` — admin-managed list of destination accounts per payment method (e.g., bKash number 01XXXXXXXXX, bank account details).
2. **Admin UI**: New management section (inside existing Admin Dashboard) to add/edit/delete deposit accounts per source method.
3. **User-facing**: After selecting a source in AddMoneyFlow, show a new intermediate step ("send_to") displaying the matching deposit account number with a copy button and instructions, before proceeding to the proof upload step.

### Database Migration

```sql
CREATE TABLE public.deposit_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  method text NOT NULL,            -- matches source_method: 'bkash', 'nagad', 'bank_transfer', etc.
  label text NOT NULL,             -- e.g. "bKash Personal"
  account_number text NOT NULL,    -- the number/account to send to
  account_name text,               -- holder name
  bank_name text,                  -- for bank transfers
  instructions text,               -- optional extra instructions
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deposit_accounts ENABLE ROW LEVEL SECURITY;

-- Admins manage
CREATE POLICY "Admins can manage deposit accounts"
  ON public.deposit_accounts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- All authenticated users can read active accounts
CREATE POLICY "Users can read active deposit accounts"
  ON public.deposit_accounts FOR SELECT TO authenticated
  USING (is_active = true);
```

### Code Changes

**New hook `src/hooks/use-deposit-accounts.ts`**
- Fetch active deposit accounts filtered by method
- Admin CRUD operations

**Edit `src/components/AddMoneyFlow.tsx`**
- Add new step `"send_to"` between `"source"` and `"proof"` (steps become: amount → source → send_to → proof → success)
- In `send_to` step: fetch deposit accounts for selected source, display account number with copy-to-clipboard button, account holder name, and any instructions
- Show a "I've sent the money" button to proceed to proof upload

**New admin section `src/components/admin/AdminDepositAccounts.tsx`**
- Table listing all deposit accounts with method, number, label, active toggle
- Add/edit dialog for creating new accounts
- Integrate into AdminDashboard as a new tab or sub-section under Fund Requests

### Files Changed
- `src/hooks/use-deposit-accounts.ts` (new)
- `src/components/AddMoneyFlow.tsx` (edit — add send_to step)
- `src/components/admin/AdminDepositAccounts.tsx` (new)
- `src/pages/AdminDashboard.tsx` (edit — add deposit accounts management)
- Database migration (new table)

