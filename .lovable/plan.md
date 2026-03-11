

## Fix: Checkmark icon clipped on phone input

**Problem**: The phone input container (line 275) has `overflow-hidden` and the checkmark icon wrapper only has `pr-4`, causing it to get clipped at the right edge on smaller screens.

**Fix in `src/pages/AuthPage.tsx`**:
- Add `shrink-0` to the checkmark `motion.div` (line 284) so it doesn't get compressed by the flex layout
- Ensure the checkmark has adequate right padding

Change line 284 from:
```tsx
<motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="pr-4">
```
to:
```tsx
<motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="pr-3 shrink-0">
```

This ensures the checkmark icon never gets squeezed or clipped by the flex container.

