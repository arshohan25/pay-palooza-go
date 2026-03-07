

## Plan: Remove Dot Stepper and Number Input Spinners

Based on the annotated screenshot, two elements need removal:

### 1. Remove Dot Stepper
Delete the `DotStepper` component definition (lines 120–133) and its usage (lines 498–501). The step indicator between header and content adds unnecessary vertical space.

### 2. Remove Number Input Spinner Arrows
Change the amount `<input type="number">` to `type="text"` with `inputMode="numeric"` to eliminate the browser's native up/down spinner arrows. Add CSS to hide any residual spinners. Update the `onChange` handler to only allow numeric/decimal input.

### Files Modified
- `src/components/SendMoneyFlow.tsx`

