# Islamic Savings & DPS — Full Implementation Plan

## Scope

Close all gaps from the audit: small backend fixes plus the entire missing frontend module. I'll keep existing working code untouched (RPCs, edge function, current Investment Hub screens) and only add what's missing or correcting what deviates from spec.

## Part A — Backend fixes (1 migration)

1. **Drop overloaded RPC signatures** (`buy_gold`, `sell_gold`, `buy_stock`, `sell_stock`) so PostgREST resolves a single function. Keep the newest, correct version of each.
2. **`process-auto-save` final-installment settlement**: when `total_paid + 1 == total_installments`, set `settled = true, is_active = false` on the schedule (edge function edit, not migration).
3. **3-month DPS lock-in**: add a guard inside `cancel_goal` / a new helper so DPS-linked goals raise an error if cancelled before 90 days from creation. Goal lock-in stays 60 days for non-DPS goals.

## Part B — Frontend module

New files:

```
src/lib/savingsReturns.ts          // STRATEGY_RETURNS, FREQ_BONUS, getEstReturn (6% cap),
                                   // calcCompoundProfit, calcDpsEstimate
src/hooks/use-savings.ts           // goals, deposits, schedules, missed payments
                                   // + realtime channels on all 6 tables
src/components/savings/
  SavingsHome.tsx                  // hub: balance, goals grid, DPS list, gold/stock cards
  GoalsList.tsx + GoalDetail.tsx   // create, deposit, withdraw, cancel (60-day)
  DpsList.tsx + DpsDetail.tsx      // create plan, timeline, repay missed, collect-now
  DpsCreateFlow.tsx                // amount, frequency, duration, strategy picker
  GoldHome.tsx + GoldBuySheet.tsx + GoldSellSheet.tsx
  StocksHome.tsx + StockBuySheet.tsx + StockSellSheet.tsx
  shared/
    SavingsPinInput.tsx
    DpsTimeline.tsx
    GoalDepositTimeline.tsx
    EstimatedReturnsCard.tsx
    StrategyPicker.tsx
    ReconciliationPanel.tsx
    TermsSheet.tsx
    DeleteConfirmSheet.tsx
    InstallmentDetailDialog.tsx
```

Behaviour:

- **Realtime**: subscribe to `savings_goals`, `savings_deposits`, `savings_auto_save`, `dps_run_log`, `dps_missed_payments`, `gold_holdings`, `stock_holdings` filtered by `user_id`. Zero-refresh.
- **First DPS installment** deducted at plan creation via `savings_deposit` RPC before `INSERT INTO savings_auto_save`.
- **Lock-in checks** surfaced in UI (60-day goal, 90-day DPS) before opening cancel sheet.
- **Live prices**: change polling interval in `use-gold-price.ts` and `use-stock-prices.ts` from 30 s → 5 min; persist to DB on each poll via a small RPC update on existing holdings.
- **PIN + SlideToConfirm**: every money-moving action (buy/sell/cancel/withdraw/repay/collect-now) goes through `SavingsPinInput → verifyPin → SlideToConfirm`, with terms checkbox where the spec requires it.
- **Plan.md fix**: also resolve the two issues already noted in `.lovable/plan.md` (Total Deposited derivation, Collect Now PIN gate) — these fall inside the new DpsDetail screen.

## Part C — Wiring

- Add `/savings` route in `src/App.tsx` (lazy-loaded `SavingsHome`).
- Replace the existing Investment Hub entry point on the dashboard to navigate to `/savings` (keep old screens accessible via deep link until parity is verified, then remove in a follow-up).

## Out of scope

- No changes to admin panels, notifications schema, or auth.
- No new Supabase tables — all 7 already exist.
- I will NOT touch `src/integrations/supabase/{client,types}.ts` or `.env`.

## Order of execution

1. Migration (Part A.1 + A.3) — wait for approval.
2. Edit `process-auto-save` (A.2).
3. Build `savingsReturns.ts` + `use-savings.ts`.
4. Build shared components.
5. Build screens top-down (Home → Goals → DPS → Gold → Stocks).
6. Wire route, swap dashboard entry, verify build.

This is a large change (~15–20 files). I'll batch writes in parallel where possible.