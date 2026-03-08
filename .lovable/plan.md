

## Smooth All Transitions

### Overview
Add globally consistent, smooth animations throughout the app using a combination of CSS transition utilities and standardized Framer Motion presets. This will make all UI elements feel cohesive and polished.

### Changes

**1. `src/index.css` — Global CSS Transitions**
- Add a global `transition-all duration-300 ease-out` utility class applied via a `*` selector override for interactive elements
- Add CSS custom properties for transition timing functions
- Add smooth scroll behavior to `html`

**2. `tailwind.config.ts` — Animation Keyframes**
- Add additional keyframes: `slide-down`, `slide-in-left`, `slide-in-right`, `zoom-in`, `zoom-out`
- Add corresponding animation utilities

**3. `src/lib/transitions.ts` (new)** — Centralized Motion Presets
Create a shared file with standardized Framer Motion transition configs:
```typescript
export const springTransition = { type: "spring", stiffness: 300, damping: 30 };
export const smoothTransition = { duration: 0.3, ease: [0.23, 1, 0.32, 1] };
export const pageVariants = { /* entry/exit for pages */ };
export const overlayVariants = { /* slide-up for sheets */ };
export const fadeVariants = { /* fade in/out */ };
export const listItemVariants = { /* staggered list items */ };
```

**4. Update Key Components with Smooth Transitions**

| Component | Enhancement |
|-----------|-------------|
| `BottomNav.tsx` | Add `transition-all duration-200` to nav items |
| `SideNav.tsx` | Add hover transitions and smooth opacity changes |
| `BalanceCard.tsx` | Already smooth — no changes |
| `TransactionList.tsx` | Already uses staggered animations — no changes |
| `QuickActions.tsx` | Add transition utilities to buttons |
| All Flows | Already have slide-up animations — ensure `exit` has smooth spring |
| `Index.tsx` (tab content) | Already has crossfade — ensure spring transition |

**5. Dialog/Sheet Components**
- Update `src/components/ui/dialog.tsx` and `src/components/ui/sheet.tsx` to use smoother `duration-300` and custom easing for overlay and content animations

**6. Button/Input Hover States**
- In `src/index.css`, add global utilities:
  - `.transition-smooth { transition: all 0.25s cubic-bezier(0.23, 1, 0.32, 1); }`
  - Apply to buttons and interactive cards

### Result
All interactions — page switches, modals, hover states, list animations — will feel smooth and consistent with a unified motion language.

