
The previous edit was cancelled mid-flight. The screenshot still shows the OLD layout: thin "1 active auto-save plan(s)" pill above Gold/Stocks, and a flat "2 Saving Goals" row below the DPS CTA. Need to re-apply the redesign cleanly.

## Redesign Savings Header — Premium 2×2 Grid (re-apply)

Replace the thin emerald pill and the flat "Saving Goals" row with two new premium tiles matching the Gold/Stocks aesthetic, forming a balanced 2×2 grid.

### Final layout
```text
┌──────── TOTAL SAVED hero ────────┐  (keep)

┌── DPS PLANS ──┐  ┌── SAVING GOALS ──┐   ← NEW row
│ 📅 emerald    │  │ 🎯 violet        │
│ 1 active      │  │ 2 active         │
│ ৳500 saved    │  │ ৳1,200 / ৳5k     │
└───────────────┘  └──────────────────┘

┌── GOLD ──┐  ┌── STOCKS ──┐  (keep existing)

┌──────── Start a DPS Plan CTA ────────┐  (keep)
```

### Tile spec (mirrors Gold/Stocks)
- `rounded-[18px]`, gradient bg `from-{accent}/15 to-{accent}/5`, border `border-{accent}/20`
- 36px gradient icon chip (rounded-xl, white icon)
- Uppercase label `text-[10px] font-bold tracking-wide text-muted-foreground`
- Value `text-base font-black tabular-nums`
- Sub `text-[10px] font-bold` in accent color
- Hover: `-translate-y-0.5`, ring in accent
- Whole tile clickable

### Accent + click target
- **DPS** (emerald, `CalendarClock`) → opens active plans drawer (`setStep("autosave")`)
- **Goals** (violet, `Target` — never PiggyBank) → switches to Goals tab (`setMainTab("goals")`)

### Data wiring (reuse existing state)
- DPS: `autoSaves.filter(active).length` for count, sum of `amount * total_paid` for saved
- Goals: `goals.length` for count, sum of `current_amount` / sum of `target_amount` for progress

### Files touched
- `src/components/SavingsFlow.tsx` — remove the thin pill block + the bottom "Saving Goals" row; insert new DPS/Goals tiles into the same 2-col grid as Gold/Stocks (so it becomes a 2×2 of tiles).

### Out of scope
- No changes to Gold/Stocks tiles, drawers, CTA banner, hero card
- No new queries, no schema changes
