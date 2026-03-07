

## Plan: Spinner-Free Amount Input in Cash Out & Payment Flows

Apply the same pattern used in SendMoneyFlow to both files — change `type="number"` to `type="text"` with `inputMode="decimal"`, add CSS to hide any residual spinners, and restrict onChange to valid numeric/decimal input.

### Files Modified

**1. `src/components/CashOutFlow.tsx`** (line 678–682)
- Change `type="number"` → `type="text"` + `inputMode="decimal"`
- Update `onChange` to only accept digits and decimal: `if (v === "" || /^\d*\.?\d*$/.test(v))`
- Add spinner-hiding CSS classes: `[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`

**2. `src/components/PaymentFlow.tsx`** (line 364–368)
- Identical changes as above.

