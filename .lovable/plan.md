

## Brand Color Overhaul: Emerald + Warm Gold

Transform EasyPay's color identity from teal/cyan to a luxurious **deep emerald green + warm gold** palette across the entire application.

### Color Palette

```text
Primary (Emerald):    hsl(152 60% 28%)  → deep emerald
Primary Light:        hsl(152 55% 42%)  → medium emerald  
Accent (Warm Gold):   hsl(42 85% 52%)   → rich warm gold
Accent Light:         hsl(40 80% 65%)   → soft gold

Gradients:
  Hero:     deep emerald → dark forest green
  Primary:  emerald → teal-emerald  
  Accent:   warm gold → amber
  Glow:     emerald glow shadows
```

### Files to Change

**1. `src/index.css` — Core CSS variables (light + dark)**
- Update `--primary` from `162 72% 38%` to `152 60% 28%` (deeper emerald)
- Update `--accent` from `36 95% 55%` to `42 85% 52%` (warmer gold)
- Update `--ring` to match new primary
- Update all gradient variables (`--gradient-primary`, `--gradient-hero`, `--gradient-accent`, etc.)
- Update all glow shadow variables to use new emerald hue
- Update dark mode variants accordingly

**2. `src/components/SplashScreen.tsx` — Splash gradient**
- Update background gradient to emerald tones
- Update accent references in the gradient blend

**3. `src/components/BalanceCard.tsx` — Hero card**
- Already uses `gradient-hero` class — will inherit from CSS changes

**4. `src/components/OnboardingSlides.tsx` — Slide gradients**
- No change needed — slides use distinct per-topic colors (pink, blue, gold)

**5. `src/lib/confetti.ts` — Success confetti colors**
- Change green tones from `#10b981`/`#34d399` to deeper emerald `#166534`/`#22c55e`
- Add warm gold particles `#d4a017`

**6. `src/pages/AuthPage.tsx` — Auth flow accents**
- Uses `hsl(var(--primary))` throughout — will inherit from CSS changes

**7. `src/components/BottomNav.tsx` — Navigation**
- Uses `gradient-primary` class — will inherit

**8. `src/pages/MerchantDashboard.tsx` — Inline gradient style**
- Update the hardcoded `hsl(162 72% 38%)` inline styles to new emerald values

**9. `src/pages/AgentB2B.tsx` — Inline gradient references**
- Uses class-based gradients — will inherit

### What stays the same
- Per-feature gradient colors (send=pink, cashout=green, payment=purple, addmoney=blue) remain distinct
- Quick action icon tints remain as-is (they're feature-specific, not brand)
- Onboarding slide backgrounds remain per-topic

### Estimated scope
- 3-4 files need direct edits (CSS vars, confetti, splash, merchant inline styles)
- ~30 files auto-inherit through CSS variable cascade

