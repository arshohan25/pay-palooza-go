
## Redesign Savings Page Header Cards — Premium 2x2 Grid

The user wants the "1 active auto-save plan(s)" pill and the "2 Saving Goals" row redesigned to match the premium card aesthetic of the Gold & Stocks tiles — turning them into a unified, balanced 2×2 grid showing balance + count.

### Current state (from screenshot)
- Total Saved hero card ✅ keep
- Thin emerald pill: "1 active auto-save plan(s)" — feels like an afterthought
- Gold tile (amber) + Stocks tile (blue) — premium look ✅ reference style
- "Start a DPS Plan" CTA banner ✅ keep
- Flat "2 Saving Goals" row at bottom — doesn't match

### Redesign

Replace the thin pill + flat goals row with **two new premium tiles** styled identically to Gold/Stocks, arranged in a 2×2 grid:

```text
┌──────── Total Saved hero ────────┐
│   icon   TOTAL SAVED  ৳1,000     │
└──────────────────────────────────┘

┌──── DPS ────┐  ┌──── GOALS ────┐
│ 📅 emerald  │  │ 🎯 violet     │
│ DPS PLANS   │  │ SAVING GOALS  │
│ 1 active    │  │ 2 active      │
│ ৳500 saved  │  │ ৳1,200 / ৳5k  │
└─────────────┘  └───────────────┘

┌──── GOLD ────┐  ┌──── STOCKS ──┐
│ (existing)   │  │ (existing)   │
└──────────────┘  └──────────────┘

┌──── Start a DPS Plan CTA ───────┐ (keep)
```

### Tile spec (matches Gold/Stocks)
- `rounded-2xl`, soft tinted gradient bg (`from-{accent}/15 to-{accent}/5`), border `border-{accent}/20`
- Top-left: gradient icon tile (52px, `rounded-xl`, accent gradient, white icon)
- Uppercase tracked label (`text-xs text-muted-foreground`)
- Big value (`text-2xl font-bold tabular-nums`) — count or amount
- Sub-line (`text-xs`) — supporting metric (saved total / progress)
- Whole tile clickable → opens existing drawer (active plans / goals manager)
- Hover: subtle lift + ring in accent color

### Accent colors
- DPS: emerald (matches existing brand savings color)
- Goals: violet/indigo (Target icon — note: Target only, never PiggyBank)
- Gold: amber (existing)
- Stocks: blue (existing)

### Data wiring
Reuse what `SavingsFlow.tsx` already loads:
- DPS active count + total saved → from existing `auto_save_plans` query
- Goals count + total progress → from existing `savings_goals` query  
- No new queries, no schema changes

### Files touched
- `src/components/SavingsFlow.tsx` — replace the thin "active plans" pill + flat "Saving Goals" row with two new premium tiles in the same 2-col grid as Gold/Stocks. Keep hero card, Gold/Stocks tiles, and DPS CTA banner unchanged.

### Out of scope
- No changes to Gold/Stocks tiles
- No changes to drawers / detail screens
- No new data fetches
