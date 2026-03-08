

## Plan: Add Sparkle/Glow Effect to Savings Coin

### Change in `src/components/QuickActionIcons.tsx` (lines 330-372)

**1. Add a radial glow filter in `<defs>`:**
- Add a `<filter id="coinGlow">` with `feGaussianBlur` + `feMerge` to create a soft golden glow around the coin

**2. Add sparkle elements around the coin:**
- 3-4 small star/diamond shapes around the coin that animate with `motion.g` — fade in/out and scale on hover
- Use `#FFD54F` / `#FFF8E1` colors to match the gold coin

**3. Apply glow filter to coin circle:**
- Wrap or apply `filter="url(#coinGlow)"` to the outer coin circle for a subtle ambient glow

### Implementation detail:

```tsx
{/* In defs: */}
<filter id="coinGlow" x="-50%" y="-50%" width="200%" height="200%">
  <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur"/>
  <feMerge>
    <feMergeNode in="blur"/>
    <feMergeNode in="SourceGraphic"/>
  </feMerge>
</filter>

{/* Glow circle behind coin */}
<motion.circle cx="12" cy="12" r="13" fill="#FFD54F" opacity={0}
  animate={isHovered ? { opacity: [0, 0.4, 0] } : { opacity: 0 }}
  transition={{ duration: 1, repeat: Infinity }}
/>

{/* 3 sparkle diamonds around coin, animated on hover */}
<motion.g animate={isHovered ? { opacity: [0,1,0], scale: [0.5,1,0.5] } : { opacity: 0 }}>
  <path d="M3 5 L4 3 L5 5 L4 7 Z" fill="#FFF8E1"/>
  <path d="M20 4 L21 2 L22 4 L21 6 Z" fill="#FFF8E1"/>
  <path d="M5 18 L6 16 L7 18 L6 20 Z" fill="#FFF8E1"/>
</motion.g>
```

Single file change, purely visual enhancement.

