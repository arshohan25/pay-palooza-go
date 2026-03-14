

## Fix: Bank Transfer Fee Showing Flat ৳5 Instead of 1%

### Root Cause
Two files have hardcoded fee values instead of using the dynamic `useFeeConfig` hook:

1. **`src/pages/AgentBankTransfer.tsx` line 53** — Fee is hardcoded as flat ৳5 for amounts over ৳100:
   ```tsx
   const fee = mode === "send" ? (Number(amount) > 100 ? 5 : 0) : 0;
   ```
   Should be 1% (matching the `fee_config` table).

2. **`src/pages/AgentBankTransfer.tsx` line 238** — Fee hint text is also hardcoded:
   ```tsx
   <p className="text-[10px] ...">Fee: ৳5</p>
   ```

3. **`src/pages/LimitsPage.tsx` lines 117-118** — Send Money fee is hardcoded as `"Free/৳3/৳5"` instead of using the dynamic `sendFee` variable that's already computed on line 100.

### Plan

**File: `src/pages/AgentBankTransfer.tsx`**
- Import `useFeeConfig` hook
- Replace hardcoded `fee` calculation (line 53) with `calcBankTransferFee(Number(amount))`
- Replace hardcoded "Fee: ৳5" text (line 238) with dynamic fee label from `getFeeLabel("banktransfer")`

**File: `src/pages/LimitsPage.tsx`**
- Replace hardcoded `"Free/৳3/৳5"` on lines 117-118 with the already-computed `sendFee` variable

### No database changes needed
The `fee_config` table already has the correct 1% percentage rule for `banktransfer`.

