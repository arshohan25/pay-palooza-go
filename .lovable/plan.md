

## Plan: Admin Treasury & Liquidity Management System

### Overview
Add a platform-level treasury system to the admin panel with a starting balance of ৳1000 crores (10,000,000,000), enabling admin fund distribution to any role, automatic treasury debiting when users add money, and earnings/commission tracking from transaction fees.

### Database Changes

**1. New `platform_treasury` table** (single-row config table)
- `id`, `balance` (starts at 10,000,000,000), `total_earnings`, `total_commissions_paid`, `total_disbursed`, `updated_at`
- RLS: admin-only read/write

**2. New `treasury_ledger` table** (audit trail for all treasury movements)
- `id`, `type` (enum: `disburse`, `earning`, `commission_paid`, `user_addmoney`, `initial_deposit`), `amount`, `balance_after`, `counterparty_user_id`, `counterparty_role`, `description`, `reference`, `actor_id`, `created_at`
- RLS: admin-only read, system insert

**3. New RPCs**
- `admin_disburse_funds(p_target_phone, p_amount, p_description)` — Admin sends treasury funds to any user. Debits treasury, credits target user balance, records in both `treasury_ledger` and `transactions`.
- `treasury_debit_for_addmoney(p_user_id, p_amount)` — Called by payment gateway webhooks. Debits treasury when a user successfully adds money.
- Modify existing fee-collecting RPCs (`record_transaction`, `transfer_money`) to credit fees to treasury `total_earnings`.

**4. Seed initial treasury balance** of ৳10,000,000,000 (1000 crores)

### Admin Dashboard UI Changes

**New "Treasury" nav item** added to admin sidebar, containing:

1. **Treasury Overview Cards** (3 cards at top):
   - **Platform Balance** — Current treasury balance (large, prominent)
   - **Total Earnings** — Accumulated fees from cashout, send money, settlements, etc.
   - **Commissions Paid** — Total paid out to agents, merchants, distributors

2. **Send Funds Section**:
   - Search user by phone number
   - Shows user info (name, phone, role badges)
   - Amount input with treasury balance validation
   - Description field
   - PIN confirmation before executing
   - Uses `admin_disburse_funds` RPC

3. **Treasury Ledger Table**:
   - Shows all treasury movements with type badges, amounts, counterparty info
   - Filterable by type (earnings, disbursements, add-money debits, commissions)

### Integration Points

- **Add Money Flow**: After payment gateway verification succeeds, call `treasury_debit_for_addmoney` to debit the equivalent from treasury (this happens in the payment webhook edge function, not client-side)
- **Fee Collection**: Modify `record_transaction` and `transfer_money` RPCs to atomically credit fee amounts to `platform_treasury.total_earnings` and insert earning entries in `treasury_ledger`
- **Cashback/Commission**: When commissions are paid (agent commission, referral rewards), record against `platform_treasury.total_commissions_paid`

### Files to Create/Modify
- New migration SQL (treasury table, ledger table, RPCs, seed data)
- New `src/components/admin/AdminTreasury.tsx` (treasury dashboard component)
- Modified `src/pages/AdminDashboard.tsx` (add Treasury nav item + tab)
- Modified `supabase/functions/payment-webhook/index.ts` (treasury debit on add-money)
- Updated `src/integrations/supabase/types.ts` (auto-generated)

