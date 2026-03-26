

# Fix: Add KYC Guard to Unprotected Financial Flows

## Problem
Three financial flows are missing `FeatureGuard` wrapping, allowing new users (with no KYC) to access them directly:
- **AddMoneyFlow** — no KYC gate
- **BankTransferFlow** — no KYC gate
- **SavingsFlow** — no KYC gate

All other financial flows (SendMoney, CashOut, Payment, PayBill, MobileRecharge, Shop) already have `FeatureGuard` wrappers.

## Fix
Apply the same pattern used by the other flows — wrap each component with `FeatureGuard` and export the guarded version as default.

### Changes (3 files)

**`src/components/AddMoneyFlow.tsx`**
- Import `FeatureGuard`
- Add `AddMoneyFlowGuarded` wrapper with `featureKey="add_money"`
- Change default export to `AddMoneyFlowGuarded`

**`src/components/BankTransferFlow.tsx`**
- Import `FeatureGuard`
- Add `BankTransferFlowGuarded` wrapper with `featureKey="bank_transfer"`
- Change default export to `BankTransferFlowGuarded`

**`src/components/SavingsFlow.tsx`**
- Import `FeatureGuard`
- Add `SavingsFlowGuarded` wrapper with `featureKey="savings"`
- Change default export to `SavingsFlowGuarded`

No other files need changes — `Index.tsx` already passes `onClose` to each flow, which is all FeatureGuard needs.

