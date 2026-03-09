

## Plan: Add Biller Categories to API Hub

### What

Add static biller integration entries to the API Hub for Electricity, Water, Gas, Internet ISPs, and TV providers. These are displayed as "not_configured" by default since there are no corresponding database tables or secrets yet -- they serve as placeholders showing which biller APIs the platform intends to support.

### Changes

**File: `src/components/admin/AdminApiHub.tsx`**

1. Import additional icons from lucide-react: `Zap` (Electricity), `Droplets` (Water), `Flame` (Gas), `Wifi` (Internet), `Tv` (TV/Cable)

2. After the existing service items (line ~114), add static biller entries grouped by category:

   - **Electricity**: DESCO, DPDC, BPDB, NESCO, WZPDCL
   - **Gas**: Titas Gas, Bakhrabad Gas, Jalalabad Gas
   - **Water**: WASA Dhaka, WASA Chittagong
   - **Internet ISPs**: BTCL, Carnival, Amber IT, Link3, DOT Internet
   - **TV / Cable**: Dish TV, Akash DTH

   All with `status: "not_configured"` and `navigateTo: "gateways"` (or a future billers tab).

3. Add the new category icons to the `categoryIcons` map.

### Files
- `src/components/admin/AdminApiHub.tsx` (modify)

