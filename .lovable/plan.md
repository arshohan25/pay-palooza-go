

## Fix All Hardcoded Fees — Use Dynamic `useFeeConfig` Everywhere

### Problem
Multiple components still use hardcoded fee values instead of the dynamic `useFeeConfig` hook. The database has the correct rules, but the UI ignores them in several places.

### Hardcoded Fee Locations Found

| File | Current Hardcoded Value | Should Be |
|------|------------------------|-----------|
| `src/components/BankTransferFlow.tsx` line 66 | `parsedAmount * 0.01` (1% hardcoded) | `calcBankTransferFee(parsedAmount)` |
| `src/pages/AgentB2B.tsx` line 84 | `Number(amount) > 100 ? 3 : 0` | `calcFee("send", Number(amount))` |
| `src/pages/MerchantDashboard.tsx` line 678 | `"Flat ৳5 fee"` desc text | Dynamic `getFeeLabel("send")` |
| `src/pages/MerchantDashboard.tsx` line 679 | `"1.15% charge"` desc text | Dynamic `getFeeLabel("cashout")` |
| `src/pages/MerchantDashboard.tsx` line 680 | `"Auto settle · 1%"` desc text | Dynamic fee label |
| `src/pages/MerchantDashboard.tsx` line 811 | `const fee = 5` (Merchant Send) | `calcFee("send", parsedAmount)` |
| `src/pages/MerchantDashboard.tsx` line 2033 | `parsedAmount * 0.0115` (Merchant Cash Out) | `calcCashOutFee(parsedAmount)` |
| `src/pages/MerchantDashboard.tsx` lines 950-953 | Hardcoded fee breakdown labels | Dynamic `getFeeLabel()` calls |

### Changes

**`src/components/BankTransferFlow.tsx`**
- Import `useFeeConfig`
- Replace `Math.round(parsedAmount * 0.01 * 100) / 100` with `calcBankTransferFee(parsedAmount)`

**`src/pages/AgentB2B.tsx`**
- Import `useFeeConfig`
- Replace `Number(amount) > 100 ? 3 : 0` with `calcFee("send", Number(amount))`
- Update fee hint text from `"Fee: ৳3"` to dynamic label

**`src/pages/MerchantDashboard.tsx`**
- Import `useFeeConfig`
- Replace hardcoded fee values in quick actions desc, fee breakdown section, MerchantSendMoneySheet (`fee = 5`), and MerchantCashOutSheet (`parsedAmount * 0.0115`) with dynamic calculations

### No database changes needed

