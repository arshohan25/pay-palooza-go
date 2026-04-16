

# Add Mandatory T&C Gate Before Savings Access

## Current State
T&C exists but is only shown as an optional checkbox during auto-save plan creation (the "review" step). Users can freely browse Gold, Stocks, and Savings tabs and even trade without ever accepting the T&C.

## Plan

### 1. Add persistent T&C acceptance tracking
- Store acceptance in `localStorage` key `mfs_savings_tc_accepted` (consistent with existing patterns like `mfs_onboarding_done`).
- Add state: `const [tcAccepted, setTcAccepted] = useState(() => localStorage.getItem("mfs_savings_tc_accepted") === "1")`.

### 2. Create a full-screen T&C gate
- When `tcAccepted` is `false`, render a mandatory T&C screen instead of the savings dashboard.
- This screen will display:
  - A shield/lock icon header with "Investment Terms & Conditions"
  - All 7 existing T&C sections (already written in the terms sheet)
  - Additional clauses: platform fee disclosure (1.5% gold spread, ৳15 stock brokerage), no guaranteed returns disclaimer, regulatory compliance note
  - A scrollable content area with a "scroll to bottom" indicator
  - A checkbox: "I have read and agree to all Terms & Conditions, risk disclosures, and fee structures"
  - A disabled-until-checked "Accept & Continue" button
- On acceptance: set `localStorage` flag and proceed to savings dashboard.

### 3. Keep existing per-trade T&C checkbox
- The auto-save review step T&C checkbox stays as-is for double confirmation on plan creation.

### File Changes
- **`src/components/SavingsFlow.tsx`** — Add `tcAccepted` state, render the gate screen when false, enhance T&C content with fee disclosures.

