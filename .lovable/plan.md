

## Plan: Add Shimmer Sweep to All Coin Badges

Add a diagonal light sweep animation across each coin badge that plays on hover, creating a premium metallic shimmer effect.

### Approach

Use an SVG `clipPath` + `rect` with a diagonal linear gradient (transparent → white → transparent) that translates across the coin on hover via `motion.rect`. Each icon gets its own shimmer element clipped to the coin circle.

### Changes in `src/components/QuickActionIcons.tsx`

**For each of the 4 icons with coin badges, add a shimmer sweep element right after the coin circle:**

1. **SendMoneyIcon** (coin at cx=42, cy=40, r=7):
   - Add a `clipPath` circle matching the coin
   - Add a `motion.rect` with a white-to-transparent gradient that sweeps left-to-right on hover

2. **ShopIcon** (coin at cx=28, cy=35, r=5):
   - Same pattern, sized to the smaller coin

3. **BankTransferIcon** (৳ text area around cx=28, cy=35):
   - Subtle shimmer sweep across the building's Taka region

4. **SavingsIcon** (coin at cx=12, cy=12, r=11):
   - Larger shimmer sweep matching the bigger coin

### Pattern per icon (example for SendMoney):
```tsx
{/* In defs: */}
<clipPath id="sendCoinClip">
  <circle cx="42" cy="40" r="7"/>
</clipPath>
<linearGradient id="shimmerGrad" x1="0" y1="0" x2="1" y2="0.3">
  <stop offset="0%" stopColor="white" stopOpacity="0"/>
  <stop offset="40%" stopColor="white" stopOpacity="0"/>
  <stop offset="50%" stopColor="white" stopOpacity="0.4"/>
  <stop offset="60%" stopColor="white" stopOpacity="0"/>
  <stop offset="100%" stopColor="white" stopOpacity="0"/>
</linearGradient>

{/* After coin circle: */}
<motion.rect
  x="30" y="28" width="24" height="24"
  fill="url(#shimmerGrad)"
  clipPath="url(#sendCoinClip)"
  initial={{ x: -24 }}
  animate={isHovered ? { x: [30, 54] } : { x: 30 }}
  transition={{ duration: 0.6, ease: "easeInOut" }}
/>
```

A single shared `shimmerGrad` gradient definition will be reused; each icon gets its own `clipPath` with the correct coin geometry. The shimmer plays once per hover interaction.

