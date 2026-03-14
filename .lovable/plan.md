

## Add Fraud Warning to Add Money Flow

Add a prominent warning banner on the **proof upload step** (the last step before submission) warning users that submitting fake details or screenshots will result in account termination and legal action.

### Changes

**File: `src/components/AddMoneyFlow.tsx`**
- Import `ShieldAlert` from lucide-react
- Add a warning banner at the top of the `step === "proof"` section (after the amount/source summary card, before the Transaction ID input) with:
  - Red/amber styled card with `ShieldAlert` icon
  - Bold heading: "⚠️ Warning"
  - Text: "Submitting fake transaction details, forged screenshots, or fraudulent proof will result in immediate and permanent account termination. Legal action may be pursued. All submissions are verified."
  - Styled with destructive/warning colors to be unmissable

