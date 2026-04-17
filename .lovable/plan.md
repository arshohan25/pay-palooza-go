

## Investigation Result: How Gold & Stock Pricing Actually Works

### Gold Price — ✅ Real-time (mostly)
**Source**: `supabase/functions/gold-price/index.ts`
- Fetches **live XAU/USD spot price** from Swissquote's free public quote feed
- Converts troy ounce → gram, then USD → BDT using `frankfurter.dev` FX rate
- 5-minute server-side cache + auto-refreshes every 5 min on the client (`use-gold-price.ts`)
- Falls back to hardcoded ৳16,200 (22K) / ৳19,500 (24K) if either API fails
- **Profit/Loss**: `goldValue - (grams × avgBuyPrice)` — real, based on live spot vs. your average buy price ✅

### Stock Price — ❌ NOT real-time (mock data)
**Source**: `MOCK_STOCKS` array hardcoded in `src/components/SavingsFlow.tsx` (line ~50)
```ts
const MOCK_STOCKS = [
  { symbol: "GRPH", name: "Grameenphone", price: 385.50, change: 2.4, ... },
  { symbol: "SQPH", name: "Square Pharma", price: 218.30, change: -0.8, ... },
  // ...static values, never updated
];
```
- Prices and `change %` are **static literals** — they never change
- "Current price" in your stock holdings just looks up the same hardcoded value
- **Profit/Loss for stocks** = `(MOCK_PRICE − avgBuyPrice) × qty` → it's mathematically correct but the "current price" side is fake, so P/L will never move unless you edit the array

### DPS / Auto-save "Estimated Profit" — ⚠️ Projected, not real
- `calcEstimatedProfit()` uses a hardcoded `STRATEGY_RETURNS` table (2%–6% annual based on duration/strategy)
- This is a **forecast** shown before opening a plan, not actual earned profit
- No real profit is credited to DPS deposits today — `total_paid` just tracks installments collected

---

## What I Recommend Fixing

Pick which to address (I can plan/implement any combination):

1. **Make stock prices real-time** — build a `stock-price` edge function pulling DSE data (e.g. dsebd.org scrape, or a free API like `dsebd-api`) with 5-min cache, mirror the gold-price pattern. Update `MOCK_STOCKS` → live fetched list.

2. **Persist live prices into `stock_holdings.current_price`** so realtime P/L works across sessions and admin reports.

3. **Make DPS profit real** — credit actual earned profit on maturity (or periodically) into the savings plan based on the strategy's declared return, instead of just being a pre-purchase estimate.

4. **Add a "Last updated" timestamp** badge to both Gold and Stock screens so users see freshness.

5. **Disclose mock data** — until #1 ships, add a small "Indicative price" label on the stock cards to be transparent.

**Which of these would you like me to plan and build?** (I'd suggest **#1 + #2 + #4** as the minimum viable fix.)

