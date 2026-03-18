
Issue identified: the Donations feature is enabled and the `/donations` route exists, but the home screen Donations button in `src/components/QuickActions.tsx` never navigates there.

What’s actually broken:
- The Donations tile appears inside the expanded “More Services” section of `QuickActions`.
- Clicking those items calls `handleMoreService(id, soon?)`.
- `handleMoreService` only handles:
  - `refer`
  - `savings`
- It does not handle `donations`, `coupons`, `careers`, or any route-based items.
- Because of that, the Donations tile does nothing when pressed unless it is marked `soon`, in which case it shows a toast.

Why I’m confident this is the issue:
- `src/App.tsx` already registers `<Route path="/donations" element={<DonationsPage />} />`
- `src/pages/DonationsPage.tsx` exists and is wired up
- Global feature toggles show `donations` is enabled
- The old `MoreSheet` component contains the correct pattern (`navigate("/donations")`), but it is not currently used by the home screen
- So the failure is in the click handler wiring, not the page or backend

Implementation plan:
1. Update `src/components/QuickActions.tsx`
   - import `useNavigate` from `react-router-dom`
   - create `const navigate = useNavigate()` inside `QuickActions`
   - extend `handleMoreService` to support route-based items, especially:
     - `donations` → `navigate("/donations")`
   - optionally also wire the other already-existing routes for consistency:
     - `coupons` → `navigate("/coupons")`
     - any other live items if desired

2. Keep the current feature-toggle behavior intact
   - do not change the global toggle checks
   - do not change the `soon` guard
   - only add the missing action for live items

3. Validate the flow after implementation
   - tap More → Donations from the home screen
   - confirm it opens `/donations`
   - select a cause, enter amount, continue to PIN step
   - verify there is no longer a “button does nothing” failure

Technical notes:
- The role-loading suggestion in the provided context does not match this bug
- The current issue is not role-gating; it is a missing navigation branch in `handleMoreService`
- The console warnings about refs in `QuickActions` / `TransactionList` are separate React/framer-motion cleanup issues and are not the likely cause of the Donations button failure

Files to change:
- `src/components/QuickActions.tsx`

Expected result:
- The Donations button on the home screen works and opens the Donations page normally.
