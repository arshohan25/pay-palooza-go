

# Fix: Recharge Balance Deduction Without Actual Processing

## Problem
When a user does a mobile recharge, the flow:
1. Calls `process-recharge` edge function (attempts operator API — likely fails silently, returns `api_available: false`)
2. **Always** calls `recordTransaction()` which deducts the balance regardless of whether the recharge actually went through

The ৳50 was deducted from the user's wallet and recorded as a completed "recharge" transaction, but no actual recharge was delivered to the phone number. The money sits as a transaction record with `[LOCAL]` tag — effectively lost.

## Root Cause
Line 435 in `MobileRechargeFlow.tsx` calls `recordTransaction()` unconditionally — even when no real operator API processed the recharge. There's no validation that the recharge actually succeeded before taking the user's money.

## Fix

### File: `src/components/MobileRechargeFlow.tsx`
- Only deduct balance (call `recordTransaction`) when the operator API actually confirmed the recharge (`apiProcessed === true`)
- When `apiProcessed === false` (LOCAL mode), do NOT deduct balance. Instead show a "pending" status or inform the user that no operator API is configured
- Alternative: If LOCAL mode should still work (for demo/testing), make this explicit — but don't silently take money

### Proposed Logic Change (lines ~435-443):
```
if (apiProcessed) {
  // Real recharge confirmed — deduct balance
  await recordTransaction({
    type: "recharge",
    amount: effectivePrice,
    fee: 0,
    recipientPhone: phone,
    recipientName: detectedOp?.name,
    reference: txnId.current,
    description: packDesc + " [API]",
  });
} else {
  // No operator API available — don't deduct, show error
  toast.error("Recharge service unavailable. Please try again later.");
  setProcessing(false);
  return;
}
```

### Edge Function: `supabase/functions/process-recharge/index.ts`
- Move balance deduction INTO the edge function so it happens atomically with API confirmation
- Alternatively, have the edge function return a clear `api_available: false` status that the client treats as a failure

## Recommendation
The simpler fix is the client-side gate: don't call `recordTransaction` unless `apiProcessed` is true. When no API is configured, show an error toast instead of silently taking money.

Single file change: `src/components/MobileRechargeFlow.tsx`

