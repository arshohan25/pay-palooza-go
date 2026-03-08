

## Plan: Fix "Soon" Badge — Remove Background, Move to Upper Right of Circle

### Change in `src/components/QuickActions.tsx` (lines 230-234)

Remove the `bg-muted/90 border border-border/60 shadow-sm` background styling from the "Soon" badge and reposition it to the upper-right corner of the circle icon.

**Before:**
```tsx
<div className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-muted/90 border border-border/60 shadow-sm z-10">
  <span className="text-[7px] font-semibold text-muted-foreground">Soon</span>
</div>
```

**After:**
```tsx
<div className="absolute -top-1.5 -right-1.5 z-10">
  <span className="text-[7px] font-bold text-muted-foreground/70">Soon</span>
</div>
```

- Removes background fill, border, and shadow
- Positions badge at upper-right corner of the circle
- Keeps text small and subtle with muted color

