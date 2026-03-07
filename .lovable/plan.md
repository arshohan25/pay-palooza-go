

## Plan: Add Framer Motion Animations to Empty State Illustrations

Wrap each empty state `div` in a `motion.div` with a staggered fade-in + scale-up + slight bounce effect. The icon will also get a gentle floating animation.

### Changes

**All three files** (`CashOutFlow.tsx`, `PaymentFlow.tsx`, `SendMoneyFlow.tsx`) follow the same pattern — replace the static `<div>` wrapper with:

```tsx
<motion.div
  initial={{ opacity: 0, scale: 0.9, y: 12 }}
  animate={{ opacity: 1, scale: 1, y: 0 }}
  transition={{ duration: 0.5, ease: "easeOut" }}
  className="flex flex-col items-center justify-center py-8 text-center"
>
  <motion.div
    animate={{ y: [0, -4, 0] }}
    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
    className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3"
  >
    <Icon className="w-7 h-7 text-muted-foreground" />
  </motion.div>
  ...
</motion.div>
```

Each file already imports `motion` from `framer-motion` (or we add it if missing).

### Files Modified
- `src/components/CashOutFlow.tsx` — lines 528-534
- `src/components/PaymentFlow.tsx` — lines 348-354
- `src/components/SendMoneyFlow.tsx` — lines 574-580

