

## Add Yearly Frequency + Save Favorite Cause

### Changes

**1. Update `process_donation` RPC** (DB migration)
- Add `yearly` handling in the frequency `IF` block: `v_next_run := v_next_run + interval '1 year'`

**2. Update `process-recurring-donations` Edge Function**
- Add yearly next-run calculation: `nextRun.setFullYear(nextRun.getFullYear() + 1)`

**3. Update `src/pages/DonationsPage.tsx`**
- Change `frequency` state type from `"weekly" | "monthly"` to `"weekly" | "monthly" | "yearly"`
- Add "Yearly" button to frequency selector (line 344) alongside weekly/monthly
- **Save favorite cause**: On successful donation, save `selectedCause.id` to `localStorage` (`mfs_fav_donation_cause`). On page load, if a saved cause exists, auto-select it and skip to the amount step (with a small "Change cause" link)
- Update the PIN confirmation badges to show "Yearly" when applicable
- Update receipt row to show "Yearly" label

**4. Files**
- **New migration**: Update `process_donation` to handle `yearly`
- **Modified**: `src/pages/DonationsPage.tsx` — yearly option + favorite cause persistence
- **Modified**: `supabase/functions/process-recurring-donations/index.ts` — yearly next-run calc

