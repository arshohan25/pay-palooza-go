

# Add PIN Confirmation + Slide to Confirm to Loan & Savings Flows

## Overview
Both the Loan and Savings flows currently use simple buttons for confirmation. Other wallet flows (Send Money, Cash Out, Payment, etc.) require a 4-digit PIN entry + SlideToConfirm slider before processing. We need to add the same security pattern to these two flows.

## What Changes

### 1. SavingsFlow.tsx — Add PIN + Slide to 4 actions
Currently these actions use plain `<motion.button>` with no PIN verification:
- **Save to Goal** (`handleSave`)
- **Create Auto-Save Plan** (`handleCreateAutoSave`)
- **Buy/Sell Gold** (`handleBuyGold` / `handleSellGold`)
- **Buy/Sell Stock** (`handleBuyStock` / `handleSellStock`)

For each, replace the confirm button with:
1. A `PinInput` component (4-digit masked input with error display)
2. A `SlideToConfirm` slider that only enables when PIN is 4 digits
3. On slide confirm: call `verifyPin(pin)` → if valid, proceed with original handler; if invalid, show error and clear PIN

### 2. LoanPage.tsx — Add PIN + Slide to loan application
Currently `handleConfirmLoan` fires from a plain `<Button>` inside the T&C sheet. Replace with:
1. After terms accepted, show PIN input step
2. `SlideToConfirm` slider labeled "Slide to Apply Loan"
3. On slide: verify PIN → submit loan application

### Technical Pattern (from existing flows)
```
- Import verifyPin, SlideToConfirm, PIN state (pin, pinError)
- PIN input: masked, 4-digit, clears on error
- SlideToConfirm disabled={pin.length < 4 || processing}
- On confirm: verify PIN server-side → proceed or show error
- 5 failed attempts → lockout (matching existing security model)
```

### Files Modified
- `src/components/SavingsFlow.tsx` — Add PIN + Slide for all 4 transaction types
- `src/pages/LoanPage.tsx` — Add PIN + Slide for loan application confirmation

