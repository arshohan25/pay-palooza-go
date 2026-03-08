

## Plan: Move "Soon" Badge Outside the Circle

### Change in `src/components/QuickActions.tsx` (lines 230-234)

Move the "Soon" badge from inside the circle's overflow area to **outside** the circle by placing it after the `motion.div` (the circle container) instead of inside it. Adjust positioning to sit at the top-right corner outside the circle.

**Current** (inside the circle `motion.div`):
```tsx
{item.soon && (
  <div className="absolute -top-1.5 -right-1.5 z-10">
    <span className="text-[7px] font-bold text-muted-foreground/70">Soon</span>
  </div>
)}
```

**Fix**: The circle has `overflow-hidden`, so the badge gets clipped. Move the badge **outside** the `motion.div` but still inside the `motion.button` (which has `relative`), and position it relative to the button. Use positioning like `absolute -top-1 right-0 z-10` to sit outside the circle's top-right corner.

