

## Plan: Remove Bank Transfer from Cash Out, Create "More" Menu

### What the user wants
The screenshot shows the Cash Out method selection with two options (Agent Cash Out and Bank Transfer). The user wants to:
1. Remove Bank Transfer from Cash Out — make Cash Out go directly to the Agent step
2. Move Bank Transfer into a new "More" section accessible from the Quick Actions grid
3. Add additional features to the "More" section

### Changes

**1. `src/components/CashOutFlow.tsx`**
- Remove the `"method"` step entirely — start directly at `"agent"` step
- Remove `cashOutMethod` state and all bank-related state/logic (`bankName`, `accountNumber`, `accountHolder`, `savedBanks`, bank step UI, `BANKS` array, `BANK_STEPS`)
- Simplify `STEPS` to `["agent", "amount", "pin"]`
- Keep all agent cash out logic intact

**2. `src/components/MoreSheet.tsx`** (new file)
- Create a bottom sheet / full-screen overlay triggered from the "More" quick action
- Include these feature items in a grid or list:
  - **Bank Transfer** — opens the existing bank transfer flow (reuse logic from CashOutFlow's bank path or link to `/agent/bank` page style inline)
  - **Savings** — opens SavingsFlow (already exists)
  - **Limits & Usage** — shows limits page (LimitsPage already exists)
  - **Spending Insights** — opens SpendingInsightsPage (already exists)
  - **Coupons & Offers** — placeholder (coming soon)
  - **Donations** — placeholder (coming soon)
- Each item: icon, label, description, tap handler
- Consistent styling with the rest of the app (rounded cards, animations)

**3. `src/pages/Index.tsx`**
- Import `MoreSheet` and add state `showMore` / `setShowMore`
- Wire the `onMore` callback: currently "more" in QuickActions triggers a toast; update to open the sheet
- Add state for `showSavings`, `showLimits`, `showInsights`, `showBankTransfer` if needed as overlays
- Import and render `SavingsFlow`, `LimitsPage`, `SpendingInsightsPage` as overlays when triggered from More

**4. `src/components/QuickActions.tsx`**
- Add `onMore` to `QuickActionsProps` interface
- Wire the `"more"` action ID to call `onMore()` instead of showing "coming soon" toast

**5. `src/components/BankTransferFlow.tsx`** (new file)
- Extract the bank transfer logic that's currently inside CashOutFlow into its own standalone flow component
- Reuse the bank selection UI, saved banks, amount, PIN, and confirmation steps
- This will be opened from the More sheet

### Files
- `src/components/CashOutFlow.tsx` — modify (remove bank path)
- `src/components/MoreSheet.tsx` — create
- `src/components/BankTransferFlow.tsx` — create (extracted from CashOut)
- `src/pages/Index.tsx` — modify (add More sheet + new flow states)
- `src/components/QuickActions.tsx` — modify (add onMore prop)

