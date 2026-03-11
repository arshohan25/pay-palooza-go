

## Fix: Checkmark icon not showing in phone input

**Problem**: The phone input container uses `overflow-hidden` which clips the checkmark icon on the right side. The input with `flex-1` and `px-4` expands to fill all available space, pushing the icon into the clipped overflow area.

**Fix in `src/pages/AuthPage.tsx`**:

1. Remove `overflow-hidden` from the container div (line 275) — the `rounded-2xl` with `border-2` already contains the visual boundary
2. Give the input `min-w-0` instead of relying on overflow-hidden to constrain it — this is the proper flexbox way to prevent a flex child from overflowing

**Line 275** — remove `overflow-hidden`:
```tsx
<div className={`flex items-center h-16 bg-card border-2 rounded-2xl transition-all shadow-card ${error ? "border-destructive" : "border-border focus-within:border-primary focus-within:shadow-glow"}`}>
```

**Line 282** — add `min-w-0` to input:
```tsx
className="flex-1 min-w-0 h-full px-4 text-lg font-bold bg-transparent focus:outline-none placeholder:text-muted-foreground/30 placeholder:font-normal"
```

This ensures the input shrinks properly within the flex container, leaving room for the checkmark icon to render.

