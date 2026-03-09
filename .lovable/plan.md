

## Fix Agent Commission Rate & Transaction Headlines

### Issues Found
1. **Wrong commission rate**: `AgentCashIn.tsx` uses `COMMISSION_RATE = 0.00499` (0.499%) — should be `0.0049` (0.49%)
2. **Wrong display rates**: `TransactionHistory.tsx` has `AGENT_COMMISSION_RATES` as `0.485` — should be `0.49`
3. **Wrong display rates**: `AgentTransactionHistory.tsx` shows "Cash In/Out: 0.485%" — should be "0.49%"
4. **Wrong commission value**: The flat ৳10 commission mentioned suggests it's hardcoded or miscalculated somewhere — the fix to 0.49% rate will make it accurate (e.g., ৳2000 × 0.49% = ৳9.80)
5. **Agent view headlines**: For agent view, cashout should show "CashOut Received" and cashin should show "Cash In Sent" instead of generic labels

### Changes

**1. `src/pages/AgentCashIn.tsx` (line 17)**
- Change `COMMISSION_RATE = 0.00499` → `0.0049` (0.49%)

**2. `src/pages/TransactionHistory.tsx` (lines 27-31)**
- Update `AGENT_COMMISSION_RATES`: cashin: `0.49`, cashout: `0.49`
- In the agent view transaction mapping (lines 116-137), override `name`/`detail` for agent view:
  - cashout → "CashOut Received"
  - cashin → "Cash In Sent"

**3. `src/pages/AgentTransactionHistory.tsx` (line 83)**
- Change "Cash In/Out: 0.485%" → "Cash In/Out: 0.49%"

**4. `src/hooks/use-fee-config.ts`** — no change needed (reads from DB `fee_config` table)

| File | Change |
|------|--------|
| `AgentCashIn.tsx` | Fix commission rate to 0.49% |
| `TransactionHistory.tsx` | Fix display rate to 0.49%, add agent-specific headlines |
| `AgentTransactionHistory.tsx` | Fix rate label to 0.49% |

