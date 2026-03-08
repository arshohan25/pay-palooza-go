

## Plan: Enhance More Services Entrance Animation (Scale from 0)

The current animation already scales icons from `0.7` → `1`. The change is to make it more dramatic by scaling from `0` and adding a slight spring bounce.

### File: `src/components/QuickActions.tsx` (lines 253-255)

Update the `motion.button` animation props:
- Change `initial` scale from `0.7` to `0` for a more dramatic pop-in effect
- Switch from easing curve to a spring transition for a natural bounce
- Keep staggered delay per item

```tsx
// Before
initial={{ opacity: 0, scale: 0.7, y: 12 }}
animate={{ opacity: 1, scale: 1, y: 0 }}
transition={{ delay: 0.06 * i, duration: 0.35, ease: [0.23, 1, 0.32, 1] }}

// After
initial={{ opacity: 0, scale: 0 }}
animate={{ opacity: 1, scale: 1 }}
transition={{ type: "spring", stiffness: 400, damping: 22, delay: 0.04 * i }}
```

Single file, 3-line change.

