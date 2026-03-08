

## Plan: Make Savings Icon More Vibrant with Larger Coin

### Changes to `src/components/QuickActionIcons.tsx` (lines 326-369)

1. **More vibrant green piggy bank**:
   - Gradient stops: `#4CAF50` → `#1B5E20` (deeper, more saturated green)
   - Snout/ear highlights: `#81C784` (brighter)
   - Legs: `#388E3C` (richer green)
   - Tail: `#388E3C`

2. **Larger golden coin**:
   - Increase coin circle radius from `r="8"` to `r="11"` 
   - Inner circle from `r="6"` to `r="8.5"`
   - Taka symbol font size from `8` to `11`
   - Adjust position slightly (e.g. `cx="12" cy="12"`) so it sits nicely at top-left
   - Keep the bounce/rotate hover animation

