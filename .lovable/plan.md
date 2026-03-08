

## Plan: Add Pulse/Glow Effect to "Soon" Items

### File: `src/components/QuickActions.tsx`

**1. Add a pulsing glow ring behind the icon circle for "Soon" items (lines 265-276)**

Inside the `motion.div` icon container, add a conditional animated div when `item.soon` is true — a gradient-colored ring that pulses using CSS `animate-pulse` with reduced opacity, creating a soft glow effect.

```tsx
{item.soon && (
  <div className={`absolute inset-0 rounded-full bg-gradient-to-b ${item.gradient} opacity-20 animate-pulse`} />
)}
```

This sits behind the icon content and uses the item's existing gradient color for a cohesive look.

**2. Add a subtle scale pulse to the "Soon" badge text (lines 277-280)**

Replace the static `div` wrapping the "Soon" label with a `motion.div` that has a continuous subtle scale animation:

```tsx
<motion.div
  className="absolute -top-1 right-0 z-10"
  animate={{ scale: [1, 1.15, 1] }}
  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
>
  <span ...>Soon</span>
</motion.div>
```

### Single file change, ~10 lines modified.

