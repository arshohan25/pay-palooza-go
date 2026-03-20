

## Fix: Donation flow skips cause selection

**Problem**: When a user has previously donated, their last-used cause is saved in `localStorage` under `mfs_fav_donation_cause`. On the next visit, the `useEffect` on line 93 of `DonationsPage.tsx` auto-restores that cause AND immediately sets `step` to `"amount"`, skipping the cause selection screen.

**Solution**: Pre-select the favorite cause (so it appears highlighted) but keep the step on `"cause"` so the user still sees the cause selection screen and can confirm or change their choice.

**File**: `src/pages/DonationsPage.tsx`

**Change** (line 93):
- Before: `if (fav) { setSelectedCause(fav); setStep("amount"); }`
- After: `if (fav) { setSelectedCause(fav); }`

This removes the `setStep("amount")` call so the flow always starts at the cause screen, with the previously-used cause pre-highlighted for convenience.

