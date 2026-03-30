

# Redesign PIN Login Screen — Premium, Modern, with Entrance Animations

## Current State
The `login_pin` screen (lines 763-842 in AuthPage.tsx) uses a basic `gradient-hero` background, a plain Lock icon in a circle, simple PinCircles dots, and minimal layout. It works but feels utilitarian.

## Design Vision
A premium, glassmorphism-heavy PIN screen inspired by high-end fintech apps:

1. **Staggered entrance animation** — Logo, greeting, PIN dots, and footer all animate in sequence with spring physics (fade-up + scale) for a polished first impression
2. **User avatar area** — Show EasyPay logo with a frosted glass ring and animated gradient border glow, replacing the plain Lock icon
3. **Personalized greeting** — "Welcome back" with the masked phone number (01•••••3012) styled elegantly
4. **Redesigned PIN dots** — Larger dots (22px) inside a frosted glass pill container with subtle inner shadow, giving a tactile feel
5. **Ambient background** — Keep gradient-hero but add a large animated radial gradient spotlight that slowly drifts, plus existing BgOrbs with increased opacity
6. **Time-based greeting** — "Good Morning/Afternoon/Evening" based on time of day
7. **Footer** — Forgot PIN and Show/Hide in a frosted glass bar at the bottom, plus a security badge

## Technical Changes

### `src/pages/AuthPage.tsx` — Login PIN section (lines 763-842)

Replace the `login_pin` AnimatePresence block with:

- **Entrance container**: `motion.div` with `initial={{ opacity: 0 }}` → `animate={{ opacity: 1 }}` + 0.15s duration
- **Logo block**: EasyPay logo image (already imported as `logo`) in a 72px frosted circle with animated gradient ring — `initial={{ scale: 0.6, opacity: 0 }}` → spring animate with 0.2s delay
- **Greeting text**: Time-based greeting ("Good Morning") + "Welcome back" subtitle + masked phone — `initial={{ opacity: 0, y: 20 }}` with 0.3s delay
- **PIN area**: Frosted glass container (`bg-white/8 backdrop-blur-md border border-white/12 rounded-3xl`) holding PinCircles + HiddenPinInput — `initial={{ opacity: 0, y: 24 }}` with 0.4s delay
- **Error/status area**: Kept as-is but inside the glass container
- **Footer actions**: Frosted glass bar at bottom with Forgot PIN | Show/Hide | Security badge — `initial={{ opacity: 0, y: 16 }}` with 0.5s delay
- **Background accent**: Additional animated radial gradient circle (slow drift animation, 12s cycle)

Helper function added at component level:
```typescript
function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}
```

### No new files needed
All changes are within the existing `login_pin` block in AuthPage.tsx. Uses existing imports (motion, framer-motion), existing components (PinCircles, HiddenPinInput, BgOrbs), and existing CSS variables.

## Files Changed
- `src/pages/AuthPage.tsx` — Replace login_pin section (~80 lines) with premium redesigned version

