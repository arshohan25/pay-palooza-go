

## Add PIN Confirmation to Add Money Flow

BankTransferFlow already has a PIN step — only AddMoneyFlow is missing it.

### Changes

**File: `src/components/AddMoneyFlow.tsx`**

1. **Add "pin" step** to the flow: Change type from `"amount" | "source" | "send_to" | "proof" | "success"` to include `"pin"`, and update `STEPS` to `["amount", "source", "send_to", "proof", "pin"]`

2. **Add imports**: `verifyPin` from `@/lib/verifyPin`, `ShieldCheck` from lucide-react, `Input` already imported

3. **Add state**: `pin` (string), `pinError` (string)

4. **Update `goBack`**: Add `if (step === "pin") { goTo("proof"); return; }`

5. **Change proof step submit**: Instead of calling `handleSubmit` directly, the "Submit Request" button now navigates to `goTo("pin")`

6. **Add `handlePinSubmit`**: Verify PIN via `verifyPin(pin)`, then run the existing `handleSubmit` logic (upload proof, call `submitAddMoney`, transition to success)

7. **Add PIN step UI**: Replicate the exact same PIN entry pattern from BankTransferFlow (shield icon, 4-dot display, hidden numeric input, visible Input field, confirm button) with emerald/green gradient styling to match the Add Money theme

