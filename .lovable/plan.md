

## Make Fireworks Feel Real — Not Robotic

### Problem
Current effect: particles spawn at top and fall straight down with uniform rotation. This looks like confetti rain, not fireworks. Real fireworks **shoot upward**, **explode radially** at a burst point, then sparks **drift down with gravity and fade**.

### New Approach — Canvas-Based Firework Simulation

Replace the CSS emoji approach with a lightweight `<canvas>` firework engine that simulates real physics:

**File: `src/components/FestivalBodyEffect.tsx`** — Full rewrite

**Firework lifecycle (real physics):**
1. **Launch** — A rocket shoots upward from bottom of screen with a glowing trail
2. **Explosion** — At peak height, it bursts into 30-60 sparks radiating outward in a sphere
3. **Drift & Fade** — Sparks decelerate, gravity pulls them down in arcs, they fade and shrink
4. **Multiple rockets** — 4-6 fireworks launch in sequence with staggered timing (0.3-1.2s apart)

**Physics per spark particle:**
- `vx`, `vy` — velocity with random radial direction from burst center
- Gravity constant pulls `vy` downward each frame
- Friction/drag slows `vx` slightly
- Alpha fades over lifetime
- Size shrinks over lifetime

**Visual details:**
- Rocket trail: short fading line during ascent
- Burst colors: themed per festival (gold for Ramadan, green for Eid, red/orange for Pohela Boishakh, blue/silver for tech festivals)
- Glow effect: each spark has a soft radial glow (`ctx.shadowBlur`)
- Screen flash: brief white/gold flash at each explosion moment
- 3 waves of launches over ~4 seconds, then canvas removes itself

**Color mapping from festival theme:**
- Ramadan/Eid: `#d4af37`, `#f5e6a3`, `#ffffff`, `#e8c547`
- Pohela Boishakh: `#e53935`, `#ff9800`, `#ffeb3b`, `#ffffff`
- Victory/Independence: `#00695c`, `#f44336`, `#ffffff`, `#ffb300`
- Default/New Year: `#6366f1`, `#f59e0b`, `#10b981`, `#ffffff`

**Performance:**
- Uses `requestAnimationFrame` — smooth 60fps
- Canvas auto-removes after all particles die (~6s)
- No DOM elements per particle (canvas draws everything)
- Total ~150-200 particles across all bursts

### Changes

| File | What |
|------|------|
| `src/components/FestivalBodyEffect.tsx` | Complete rewrite: canvas-based firework engine with real physics (launch → explode → drift → fade) |

No other files need changes.

