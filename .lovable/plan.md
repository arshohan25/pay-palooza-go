

## Plan: Animated Empty States for Merchant, Agent & User Transaction Views

### 1. TransactionList.tsx (line 211) — User home page recent transactions
Replace the plain `<div>` with an animated empty state using `motion.div` entrance + floating icon. Use `FileText` icon with "No transactions yet" / "Your transactions will appear here".

### 2. MerchantDashboard.tsx (lines 1130-1134) — Merchant transaction list
Replace the static empty state with the same animated pattern. Keep the `Receipt` icon already in use, add floating animation and entrance transition.

### 3. AgentTransactionHistory.tsx — No changes needed
This page delegates to `<TransactionHistory>` which already has the animated empty state.

### Pattern Applied
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
  <p className="text-sm font-semibold text-foreground">Title</p>
  <p className="text-xs text-muted-foreground mt-1">Subtitle</p>
</motion.div>
```

### Files Modified
- `src/components/TransactionList.tsx` — line 211
- `src/pages/MerchantDashboard.tsx` — lines 1130-1134

