

## Fix: Merchant Send Money Fee Label

### Problem
The Merchant Dashboard "Send Money" quick action card calls `getMerchFeeLabel("send")`, which returns the **user-tier** send money fee schedule ("Free ≤৳100, ৳3 >৳100–৳50,000, ৳5 >৳50,000–৳400,000"). Merchant send money is a flat ৳5 per transaction — the label should just say "Flat ৳5/txn".

### Solution
Hardcode the merchant-specific fee description on line 683 instead of using the dynamic `getFeeLabel("send")`.

**File: `src/pages/MerchantDashboard.tsx`**
- Line 683: Change `desc: getMerchFeeLabel("send") || "Fee varies"` → `desc: "Flat ৳5/txn"`

One-line change.

