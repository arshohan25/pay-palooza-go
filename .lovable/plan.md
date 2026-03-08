

## Plan: Replace Savings Piggy Bank with a Growing Plant / Sprout Icon

The piggy bank concept is already used — replace with a **growing sprout/plant in a pot** representing growth and savings.

### Changes to `src/components/QuickActionIcons.tsx` (lines 326-369)

Replace the entire `SavingsIcon` component with a new illustrated SVG:

- **Pot**: Rounded trapezoid in warm terracotta/brown (`#8D6E63` → `#5D4037` gradient)
- **Soil**: Dark brown arc at top of pot
- **Stem**: Green curved line growing upward
- **Leaves**: Two vibrant green leaves (`#4CAF50` → `#1B5E20`) on either side of the stem
- **Coin badge**: Keep the existing golden Taka coin (large, `r=11`) at top-right — bounces on hover
- **Hover animation**: The plant/leaves gently sway or scale up slightly

This gives a "money growing" metaphor that's distinct from the piggy bank.

