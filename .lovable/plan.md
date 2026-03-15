

## Commission & Charge Management System — Gap Analysis and Plan

### Current State

The existing system has:
- **`fee_config` table** with `agent_commission`, `distributor_commission`, `platform_share` columns (percentage-based)
- **`AdminChargeConfig`** — CRUD for fee rules (flat/percentage per txn type with amount ranges)
- **`AdminCommissionSetup`** — edits commission splits on existing fee_config rows
- **`transfer_money` RPC** — already passes commission to agents and debits treasury
- **`useFeeConfig` hook** — calculates fees and agent commission client-side

### What's Missing

1. **No Master Distributor tier** — only agent + distributor + platform exist
2. **No commission tiers** — no amount-range-based commission rates (e.g., per ৳1000 breakdown)
3. **No commission_logs table** — commissions aren't audited separately from transactions
4. **No automatic company profit calculation** — `Total Fee - (Agent + Distributor + Master Distributor)`
5. **No Cash In commission support** — current system only handles cashout commission
6. **AdminCommissionSetup lacks tier management and per-1000 breakdown UI**
7. **No real-time commission calculator preview for admins**

### Implementation Plan

#### 1. Database Migration

**Add `master_distributor_commission` column to `fee_config`:**
```sql
ALTER TABLE fee_config ADD COLUMN master_distributor_commission numeric DEFAULT 0;
```

**Create `commission_tiers` table** — amount-range-based commission breakdown:
- `id`, `fee_config_id` (FK), `min_amount`, `max_amount`, `agent_rate`, `distributor_rate`, `master_distributor_rate`, `company_rate` (auto-calculated), `is_active`

**Create `commission_logs` table** — audit trail for every commission event:
- `id`, `transaction_id` (FK), `txn_type`, `txn_amount`, `total_fee`, `agent_id`, `agent_amount`, `distributor_id`, `distributor_amount`, `master_distributor_id`, `master_distributor_amount`, `company_amount`, `created_at`

**Add `cashin` to TXN_TYPES** in fee_config and the RPC.

**Create `calculate_commission` RPC** — given a txn type and amount, returns the full breakdown (agent, distributor, master distributor, company) using tier matching.

**Update `transfer_money` RPC** — after a transaction completes, insert a row into `commission_logs` with the full breakdown and credit each party's wallet.

**Seed default commission tiers** for cash_in and cash_out matching the spec (per ৳1000: Agent ৳4.90, Distributor ৳2.00, Master Distributor ৳1.50, Company = remainder of 1.19%).

#### 2. Update `AdminCommissionSetup.tsx` — Complete Rebuild

Replace with a tabbed interface:
- **Tab 1: Commission Rules** — shows fee_config rows with the new master_distributor column, per-txn-type commission percentages, auto-calculated company profit
- **Tab 2: Commission Tiers** — CRUD for amount-range tiers with per-1000 breakdown preview (Agent ৳4.90, Distributor ৳2.00, MD ৳1.50, Company ৳3.40)
- **Tab 3: Commission Logs** — searchable audit trail with date filter, txn type filter, CSV export
- **Tab 4: Calculator** — real-time commission simulator: enter amount + txn type → see full breakdown

#### 3. Update `useFeeConfig` Hook

- Add `master_distributor_commission` to the `FeeRule` interface
- Add `getMasterDistributorCommission()` and `getCompanyProfit()` helpers
- Add `getCommissionBreakdown(txnType, amount)` → returns `{ agent, distributor, masterDistributor, company, totalFee }`

#### 4. Update `transfer_money` and `record_transaction` RPCs

- Look up the agent's distributor and master distributor from the hierarchy (`agents` → `distributors` → find super distributor)
- After crediting agent commission, also credit distributor and master distributor wallets
- Insert a `commission_logs` row with the full breakdown
- Auto-calculate company profit as `totalFee - agent - distributor - masterDistributor`

#### 5. Wire into Admin Dashboard

Add "cashin" to `TXN_TYPES` array in `AdminChargeConfig`. No new nav items needed — the existing Commission Setup tab gets the upgraded UI.

### Summary of Changes

| Component | Action |
|-----------|--------|
| DB: `fee_config` | Add `master_distributor_commission` column |
| DB: `commission_tiers` | New table for amount-range tiers |
| DB: `commission_logs` | New audit table |
| DB: RPCs | New `calculate_commission`, update `transfer_money` |
| DB: Seed data | Default tiers for cashin/cashout per spec |
| `AdminCommissionSetup.tsx` | Full rebuild with 4 tabs |
| `useFeeConfig` hook | Add MD commission + breakdown helpers |
| `AdminChargeConfig.tsx` | Add "cashin" to txn types |

