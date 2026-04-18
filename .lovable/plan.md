

## Admin Investment P/L Dashboard (Gold & Stocks)

### What to build

New admin tab **"Investment P/L"** under Admin Dashboard showing platform-wide and per-user unrealized profit/loss for Gold and Stocks holdings.

### Component: `src/components/admin/AdminInvestmentPnL.tsx`

**Top summary cards (4):**
- Total Gold Invested (sum of `avg_buy_price × grams`)
- Total Gold Current Value (sum of `current_price_per_gram × grams`)
- Total Stocks Invested (sum of `avg_buy_price × qty`)
- Total Stocks Current Value (sum of `current_price × qty`)
- Each card shows net P/L with green/red badge and % change

**Two tabs: Gold | Stocks**

Per-user table with columns:
- User (name + phone)
- Gold: grams · avg buy · current · invested · current value · **P/L (৳ + %)**
- Stocks: symbol · qty · avg buy · current · invested · current value · **P/L (৳ + %)**
- Sortable by P/L; filter winners/losers; CSV export

**Live sync:** subscribe to `gold_holdings` and `stock_holdings` UPDATE events → recompute totals instantly (same pattern as user-side SavingsFlow).

### Data fetching

Two queries joining holdings with profiles:
```ts
supabase.from("gold_holdings").select("*, profiles!inner(name, phone)").gt("grams", 0)
supabase.from("stock_holdings").select("*, profiles!inner(name, phone)").gt("qty", 0)
```
P/L computed client-side from existing columns (no DB change needed — `current_price` is already kept fresh by the polling hook).

### Wiring

- Add tab entry in `src/pages/AdminDashboard.tsx` (under Revenue/Treasury group)
- Icon: `TrendingUp` from lucide-react
- Follow existing admin UI pattern (header with icon+title, card-based mobile layout, glass styling)

### Files touched
- **New**: `src/components/admin/AdminInvestmentPnL.tsx`
- **Edit**: `src/pages/AdminDashboard.tsx` (register new tab)

### Out of scope
- Realized P/L history (would need a `gold_trades` / `stock_trades` ledger — not present today)
- Per-symbol aggregation across users (can add later as a 3rd sub-tab)

