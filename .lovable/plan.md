

## Plan: Update Savings Icon, Fix "Soon" Styling, Add Scale-Up Entrance

### 1. Change Savings Icon (`QuickActionIcons.tsx`)
Replace the current teal piggy bank with a warmer green/yellow piggy bank matching the reference image — rounder body, brighter green with a yellow coin on top, pink/peach accent tones.

### 2. Fix "Soon" Badge Styling (`QuickActions.tsx`)
Currently "Soon" items have `opacity-60` making them look broken/disabled, and use a pulsing red destructive badge which is too aggressive. Fix:
- Remove `opacity-60` class from soon items so they look normal
- Replace the red destructive badge with a subtle muted pill badge (small grey/muted text, no pulsing animation)

### 3. Add Scale-Up Entrance Animation (`QuickActions.tsx`)
Update each More Services icon's `motion.button` to include `initial={{ opacity: 0, scale: 0.7, y: 12 }}` and `animate={{ opacity: 1, scale: 1, y: 0 }}` with staggered delays, so icons pop in with a scale-up effect when the section expands.

