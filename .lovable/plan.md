

## Fix Bill Pay Commission & Recalculate Transactions

### Current State
- **Cash In/Out**: fee_config already has `agent_commission = 0.49` — correct. Transaction commissions already recalculated correctly at 0.49%.
- **Bill Pay (paybill)**: fee_config has `agent_commission = 0.0000` — wrong. Should be `0.019`. One paybill transaction has commission=৳8 on ৳2,500 (0.32%) — should be ৳0.48 (0.019%).

### Changes

**1. Database data updates (insert tool):**

```sql
-- Fix fee_config: set paybill agent_commission to 0.019
UPDATE fee_config SET agent_commission = 0.019 WHERE txn_type = 'paybill';

-- Recalculate all paybill transaction commissions at 0.019%
UPDATE transactions SET commission = ROUND(ABS(amount) * 0.00019, 2) WHERE type = 'paybill';
```

**2. Code update — `src/pages/AgentTransactionHistory.tsx`:**
- Update the label from `"Bill Pay: 0.0201%"` to `"Bill Pay: 0.019%"`

**3. Code update — `src/pages/TransactionHistory.tsx`:**
- Update `AGENT_COMMISSION_RATES` to add/fix `paybill: 0.019`

| Target | Current | New |
|--------|---------|-----|
| fee_config (paybill) | 0.0000 | 0.019 |
| Transaction ৳2,500 paybill | ৳8.00 | ৳0.48 |
| UI label | 0.0201% | 0.019% |

