

## Audit + Production-Hardening: Savings (Goals/DPS), Gold, Stocks, Loan

### The immediate bug (screenshot)

"Dream Bike" shows `0% / ৳5,000 remaining` with a `WITHDRAWN` badge after payout. That's wrong — a withdrawn goal is **archived**, not "0% in progress". The card is rendering the active-goal layout (progress bar + "X remaining") for a terminal state.

**Root cause** — `src/components/SavingsFlow.tsx` Goals list card renders the same `<progress + remaining>` block for every status. Only `active` should show progress; `completed` should show "Ready to withdraw"; `withdrawn` should show an archived chip with the payout date and amount.

---

### Senior-dev audit — what's missing for production across all 5 flows

I traced every flow against the live DB and found the gaps below. Each is a real production hole, not polish.

#### 1. Goals (`savings_goals`) — **partially shipped**
- ❌ List card shows "0% / remaining" for `withdrawn` (the bug above)
- ❌ No payout amount/date stored on the row → "Withdrawn ৳7,200 on Apr 17" can't be displayed
- ❌ No "Reopen / Top up again" path (user might want a fresh cycle on the same goal name)
- ❌ Delete trash icon on a `withdrawn` row works, but no confirm dialog → accidental data loss
- ❌ No empty-state when all goals are withdrawn (currently looks like no goals exist)

#### 2. DPS (`savings_auto_save`) — **gaps**
- ❌ No "Pause / Resume" — user can only delete, losing the streak
- ❌ Missed-payment repayment UX exists but no consolidated "Catch up" button (user sees individual missed rows but can't bulk-repay)
- ❌ No early-withdrawal path before maturity (with profit forfeiture warning)
- ❌ No history view of past matured/settled plans (they just disappear from "Active")
- ❌ Maturity claim banner doesn't show **days overdue** if user ignores it

#### 3. Gold (`gold_holdings` + `gold_transactions`) — **major gap**
- ❌ **No SELL flow** — users can buy gold but can't liquidate. Production blocker.
- ❌ No price-alert subscription ("notify me when 22k drops below ৳X")
- ❌ No P&L display (current value vs avg buy price → unrealized gain/loss %)
- ❌ Holdings card doesn't link to Gold transaction history (only generic txns)

#### 4. Stocks (`stock_holdings` + `stock_transactions`) — **major gap**
- ❌ **No SELL flow** — same blocker as Gold
- ❌ No portfolio-level P&L (sum of (current_price − avg_buy) × qty)
- ❌ No watchlist / favorites
- ❌ No order types beyond market (no limit orders, even paper-traded)
- ❌ No dividend history table even though Sharia-screened stocks may distribute

#### 5. Loan (`loans`) — **gaps**
- ❌ No **partial repayment** — only full settle (production blocker for ৳10k+ loans)
- ❌ No repayment schedule / EMI breakdown shown to user before disbursement
- ❌ No reminder notifications on due date (and 3 / 1 day before)
- ❌ No late-fee handling logic (Sharia: optional charity-redirected late fee)
- ❌ No "Loan history" tab — settled loans vanish
- ❌ Eligibility check is hardcoded; no dynamic credit-score-style display

#### Cross-cutting gaps (all 5 flows)
- ❌ **No PDF statement export** per asset class (gold purchase history, stock trades, DPS installments, loan schedule) — users will demand this for tax/audit
- ❌ **No idempotency keys** on RPCs → double-tap on slider can double-charge
- ❌ Realtime channels work but no **optimistic UI** → user waits 200-500ms after slide
- ❌ No **transaction receipts** (the standard `TxnToast` + share-receipt) for savings/gold/stocks/loan operations — they only get a toast
- ❌ No analytics events fired → admin can't see funnel drop-off

---

### Scope decision — phase this work

Doing all of the above in one ship will be ~12-15 files and risk regressions. I'll **phase it into 3 batches**, each independently shippable. This message ships **Batch 1 (the bug + the must-have production blockers)**. After approval of Batch 1 you can continue to Batch 2 and 3.

---

## Batch 1 (THIS PLAN) — ship now

### A. Fix the "Withdrawn shows 0%" bug
**`src/components/SavingsFlow.tsx`** — Goals list card:
- If `status === 'withdrawn'`: render archived layout
  - Muted icon tile, name, **"Withdrawn ৳X • {date}"** subtitle
  - No progress bar, no "remaining"
  - Trash icon → confirm dialog before delete
  - Tapping the card opens a read-only summary (no deposit form, already done)
- If `status === 'completed'`: render "Ready to withdraw" amber pill + 100% gold bar
- Active: unchanged

### B. Store payout metadata so we can show it
**Migration** — add columns + backfill:
```sql
ALTER TABLE savings_goals
  ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz,
  ADD COLUMN IF NOT EXISTS withdrawn_amount numeric(14,2);

CREATE OR REPLACE FUNCTION public.withdraw_completed_goal(p_goal_id uuid)
-- update existing function to also SET withdrawn_at = now(), withdrawn_amount = v_goal.saved_amount
```

### C. Gold SELL flow (production blocker)
**Migration** — new RPC `sell_gold(p_grams numeric, p_purity text)`:
- Validates user holds enough grams of that purity
- Reads live price from `gold_prices` table (latest)
- Credits wallet = grams × current_sell_price (5% spread vs buy)
- Decrements `gold_holdings`, inserts `gold_transactions` row with `type='sell'`
- Inserts `transactions` row `type='addmoney'` description `Gold Sale: Xg 22k`
- Returns `{success, credited, new_balance, new_holding_grams}`

**`src/components/SavingsFlow.tsx`** Gold tab:
- Holdings card → add "Sell" button next to "Buy More"
- Sell sheet: grams input + purity selector + live price preview + P&L delta + PIN + slide

### D. Stocks SELL flow (production blocker)
**Migration** — new RPC `sell_stock(p_symbol text, p_quantity int)`:
- Validates holding qty ≥ requested
- Reads latest `stock_prices` row for symbol
- Credits wallet = qty × current_price (no spread, just 0.5% brokerage fee)
- Decrements `stock_holdings`, inserts `stock_transactions` row `type='sell'`
- Inserts `transactions` row `type='addmoney'` description `Stock Sale: Nx SYMBOL`
- Returns `{success, credited, fee, new_balance, new_qty}`

**`src/components/SavingsFlow.tsx`** Stocks tab:
- Each holding row → "Sell" button
- Sell sheet: qty input (with "Sell All" shortcut) + live price + brokerage fee line + P&L delta + PIN + slide

### E. Loan partial repayment (production blocker)
**Migration** — extend existing repay function (or new `repay_loan_partial(p_loan_id, p_amount)`):
- Validates amount ≤ outstanding (principal + flat fee remaining)
- Decrements `loans.outstanding_amount`, increments `loans.repaid_amount`
- If outstanding hits 0 → status = 'settled'
- Inserts `transactions` row `type='payment'` description `Loan Repayment: ৳X (partial)`

**`src/pages/LoanPage.tsx`**:
- Active loan card → "Repay" button opens sheet with amount input (default = full outstanding, "Repay All" shortcut)
- Show updated outstanding after repayment in the sheet preview

### F. Notification trigger update for new descriptions
**Migration** — extend the `notify_transaction_recipient` trigger we just shipped to also recognize:
- `Gold Sale:%` → "You sold Xg 22k for ৳Y"
- `Stock Sale:%` → "You sold Nx SYMBOL for ৳Y"
- `Loan Repayment%(partial)` → "৳X repaid. ৳Y remaining"

---

### Files touched (Batch 1)
- `src/components/SavingsFlow.tsx` — withdrawn-state card, gold sell UI, stock sell UI
- `src/pages/LoanPage.tsx` — partial repay sheet
- New migration — `withdrawn_at`/`withdrawn_amount` cols, updated `withdraw_completed_goal`, `sell_gold` RPC, `sell_stock` RPC, `repay_loan_partial` RPC, updated `notify_transaction_recipient`

### Out of scope (will propose as Batch 2 & 3 after this ships)
- **Batch 2** — DPS pause/resume + bulk catch-up + history; Gold/Stock P&L cards + price alerts; Loan EMI schedule + reminders
- **Batch 3** — PDF statement exports per asset class; idempotency keys on all RPCs; optimistic UI; receipt sheets via `TxnToast`/`ShareReceiptSheet`; admin analytics events; watchlist + dividend history

This batching keeps each ship reviewable and lets you test the SELL flows live (the highest-impact change) before we layer polish.

