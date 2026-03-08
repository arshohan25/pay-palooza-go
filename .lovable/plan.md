

## Plan: Add Sparkle/Glow to Coin/Money Icons

Add the same sparkle and glow effect pattern from `SavingsIcon` to the other icons that have visible coin or Taka (৳) badge elements.

### Icons to update in `src/components/QuickActionIcons.tsx`:

**1. SendMoneyIcon (lines 8-41)** — Has a gold coin badge at `cx=42, cy=40, r=7`
- Add a `coinGlow` filter (with unique ID `sendCoinGlow`)
- Add a pulsing glow `motion.circle` behind the coin
- Add 3 sparkle diamond paths around `(42, 40)`
- Apply glow filter to the existing coin circle

**2. ShopIcon (lines 214-235)** — Has a ৳ circle at `cx=28, cy=35, r=5`
- Add a `shopCoinGlow` filter in defs
- Add a pulsing glow `motion.circle` behind the ৳ badge
- Add 3 sparkle diamonds around `(28, 35)`
- Apply glow filter to the badge circle

**3. BankTransferIcon (lines 276-311)** — Has ৳ text at `(28, 38)` but no coin circle; skip or add a very subtle glow behind the text only — will add a small pulsing glow circle behind the ৳ text and 2 sparkle diamonds for subtlety.

All effects are hover-only (`isHovered` gated), matching the SavingsIcon pattern with `motion.circle` glow pulse and `motion.g` sparkle diamonds.

