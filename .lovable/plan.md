

## Redesign Payment Flow UI — Premium Minimalist Card

The entire `/pay` page will be redesigned with a refined, modern aesthetic while keeping all backend logic untouched. The focus is on cleaner spacing, subtle gradients, refined typography, and polished micro-interactions.

### Design Direction
- **Frosted glass card** with stronger backdrop blur and refined border glow
- **Gradient mesh background** replacing the simple floating orbs — two-tone subtle radial gradients
- **Merchant avatar** with a soft ring glow and gradient icon background
- **Amount display** with a thin divider line and currency in a muted pill badge
- **Step indicator** redesigned as a slim segmented progress bar (not dots)
- **Phone input** in a pill-shaped container with inner shadow
- **OTP boxes** — thinner, taller, with a soft bottom-line style instead of full border boxes
- **PIN dots** — minimal circles with a pulse glow on active
- **Processing** — single elegant rotating ring with a checkmark morphing animation
- **Success** — large gradient checkmark circle, receipt card with alternating row shading
- **Error** — soft red glow card with retry button
- **Footer** — subtle "Secured by EasyPay" with a small shield icon

### File Changes

**`src/pages/PayPage.tsx`** (UI-only, all hooks/callbacks/logic preserved):

1. **Background**: Replace `FloatingOrbs` with a cleaner gradient mesh — two fixed radial gradients using `bg-gradient-to-br` with primary/accent tones, plus a subtle grid pattern overlay
2. **Main card**: Increase backdrop blur to `backdrop-blur-2xl`, add `shadow-2xl shadow-primary/5`, use `border border-white/10 dark:border-white/5` for a glass edge
3. **Merchant header**: Add a soft gradient ring around the store icon, use `bg-gradient-to-br from-primary/20 to-primary/5`. Amount gets a separate pill-style container
4. **Step progress**: Replace `StepDots` with a horizontal segmented bar — three segments, filled segments use primary gradient, inactive are muted. Labels below each segment
5. **Phone input**: Pill shape with `rounded-full`, inner shadow `shadow-inner`, larger padding, subtle border glow on focus
6. **OTP input**: Switch to underline-style slots — no side borders, just a bottom line that glows primary when active. Wider spacing
7. **PIN input**: Smaller dots (w-12 h-12), cleaner border radius (rounded-xl), softer glow
8. **Processing**: Single concentric ring spinner with the lock icon, remove the triple-ripple effect for cleaner look
9. **Success**: Gradient circle background behind checkmark, receipt rows with `even:bg-muted/20` alternating, transaction ID in a copyable chip
10. **QR Modal**: Tighter padding, add a subtle gradient header bar
11. **Footer**: Centered with a thin top separator line

All state management, API calls, haptics, sounds, and navigation logic remain exactly as-is.

