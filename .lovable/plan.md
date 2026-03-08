

## Plan: Add Shimmer Sweep to "Soon" Icons

### File: `src/components/QuickActions.tsx`

Add a shimmer overlay div inside the icon container for `item.soon` items — a diagonal white gradient that sweeps left-to-right infinitely using a CSS animation.

### File: `src/index.css`

Add a `@keyframes shimmer-sweep` animation that translates a narrow white gradient band from -100% to 200% across the element.

### Changes

**`src/index.css`** — Add keyframes:
```css
@keyframes shimmer-sweep {
  0% { transform: translateX(-100%) rotate(-20deg); }
  100% { transform: translateX(200%) rotate(-20deg); }
}
```

**`src/components/QuickActions.tsx`** — After the existing pulse div (line 274), add a shimmer overlay for `item.soon`:
```tsx
{item.soon && (
  <div
    className="absolute inset-0 rounded-full overflow-hidden pointer-events-none"
  >
    <div
      className="absolute inset-0"
      style={{
        background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.25) 50%, transparent 60%)",
        animation: "shimmer-sweep 2.5s ease-in-out infinite",
      }}
    />
  </div>
)}
```

Two files, ~10 lines total.

