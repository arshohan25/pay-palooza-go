

# Minor Fix: forwardRef Warning on PinCircles

## Current State
The app is working correctly after all recent changes. The only issue is a **React warning** in the console:

> "Function components cannot be given refs. Check the render method of AuthPage."

This happens because `PinCircles` is a plain function component used inside `AnimatePresence`, and Framer Motion tries to attach a ref to it.

## Fix
Wrap `PinCircles` with `React.forwardRef` in `src/pages/AuthPage.tsx` so the ref passes through cleanly and the warning disappears.

## Change

**`src/pages/AuthPage.tsx`** — Convert PinCircles from:
```tsx
function PinCircles({ pin, error, length, dark }) { ... }
```
to:
```tsx
const PinCircles = forwardRef<HTMLDivElement, Props>(({ pin, error, length, dark }, ref) => {
  return <div ref={ref} ...>...</div>;
});
```

This is a single-component, single-file change with zero risk.

