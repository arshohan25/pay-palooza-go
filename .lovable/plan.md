

## Fix Receipt Icon Color to Match Home Icon — Send Money Flow

### Problem
The Send Money success receipt uses `gradient-addmoney` (blue) for its icon circle, but the home screen Send Money icon uses a pink/rose gradient (#F06292 → #AD1457). This is the only flow with a mismatch.

All other flows already match:
- Cash Out → green (`gradient-cashout`) ✅
- Payment → purple (`gradient-payment`) ✅
- Bank Transfer → blue ✅
- Add Money → blue (`gradient-addmoney`) ✅
- Mobile Recharge → operator brand color ✅
- Pay Bill → bill type gradient ✅

### Change

**File: `src/components/SendMoneyFlow.tsx` (line 958)**

Change the success icon circle class from `gradient-addmoney` to `gradient-send`:

```
- className="w-24 h-24 gradient-addmoney rounded-full ..."
+ className="w-24 h-24 gradient-send rounded-full ..."
```

This aligns with the existing CSS utility `.gradient-send` which is defined as `linear-gradient(135deg, hsl(330 80% 55%), hsl(340 75% 45%))` — matching the pink/rose palette of the Send Money home icon (#F06292 → #AD1457).

Single one-line change. No other flows need updating.

