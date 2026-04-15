

# Add Platform Fees on Gold & Stock Trading

## Current State
All 4 RPCs (`buy_gold`, `sell_gold`, `buy_stock`, `sell_stock`) charge **zero fees**. The `fee` column in transactions is hardcoded to `0`. Platform treasury receives nothing from investment trades.

## Proposed Fee Structure

### Gold Trading — 1.5% Spread
- **Buy**: User pays `price × 1.015` (1.5% above market). Extra goes to treasury.
- **Sell**: User receives `price × 0.985` (1.5% below market). Difference goes to treasury.
- Effectively a 1.5% commission each way, shown transparently in UI.

### Stock Trading — ৳15 Flat Brokerage
- **Buy & Sell**: ৳15 flat fee deducted from wallet, recorded in `fee` column.
- Fee credited to `platform_treasury`.

## Changes

### 1. Database Migration — Update all 4 RPCs
- **`buy_gold`**: Calculate `v_platform_fee := ROUND(v_cost * 0.015)`, add to `v_cost`, deduct extra from wallet, credit treasury.
- **`sell_gold`**: Calculate `v_platform_fee := ROUND(v_revenue * 0.015)`, subtract from `v_revenue`, credit treasury.
- **`buy_stock`**: Add `v_brokerage := 15`, deduct from wallet alongside cost, credit treasury.
- **`sell_stock`**: Add `v_brokerage := 15`, deduct from revenue, credit treasury.
- All RPCs update the `fee` column in the transaction record and insert a `treasury_ledger` entry.

### 2. Frontend — `src/components/SavingsFlow.tsx`
- Show fee breakdown before PIN confirmation:
  - Gold: "Market: ৳X/g • Platform fee (1.5%): ৳Y • Total: ৳Z"
  - Stock: "Cost: ৳X • Brokerage: ৳15 • Total: ৳Z"
- Display fees in the success receipt.

### Summary
- 1 migration (update 4 RPCs with fee logic + treasury credits)
- 1 file edit (`SavingsFlow.tsx` — fee display in confirm/receipt)
- Treasury earns revenue from every investment trade

