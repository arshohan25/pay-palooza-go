

## Smoother "More" Section Scroll & Transition

### Problem
The More section expand/scroll feels abrupt — the `scrollIntoView` fires too early (100ms delay) before the height animation completes, and `block: "start"` jumps harshly.

### Changes

**`src/components/QuickActions.tsx`**
1. **Increase scroll delay** from 100ms to 350ms (matching the 0.35s expand duration) so scroll starts after the section is fully visible.
2. **Change `block: "start"` to `block: "nearest"`** for a gentler scroll that only moves if needed.
3. **Speed up the expand animation** from 0.35s to 0.25s for snappier feel.
4. **Soften the exit animation** — add a slightly faster exit (0.2s) so collapse feels responsive.
5. **Remove the item wiggle rotation** (`rotate: [0, 0, -8, 8, -4, 0]`) which adds visual noise, replace with a clean scale-in spring.
6. **Reduce stagger delay** from 0.04s to 0.03s per item for faster grid reveal.

### Summary of Values
| Property | Before | After |
|----------|--------|-------|
| Expand duration | 0.35s | 0.25s |
| Scroll delay | 100ms | 280ms |
| Scroll block | `start` | `nearest` |
| Item stagger | 0.04s | 0.03s |
| Item rotate animation | yes | removed |
| Exit duration | 0.35s | 0.2s |

