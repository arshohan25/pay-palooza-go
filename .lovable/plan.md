

## Fix: Add margin to the right of checkmark icon

**File**: `src/pages/AuthPage.tsx`

**Change**: Add `mr-2` (margin-right) to the checkmark icon wrapper to create space from the container edge.

**Line 284**:
```tsx
<motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="pr-3 mr-2 shrink-0">
```

This adds 8px of margin to the right of the checkmark icon.

