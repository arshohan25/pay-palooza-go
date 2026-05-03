I found the cause: the manager login page is using the shared device auth flags (`mfs_device_phone` and `mfs_has_authenticated`) that are also used by the main wallet/merchant returning-user flow. On successful manager login it writes the manager phone into `mfs_device_phone`, and on logout the app does not clear that phone. The page also uses `mfs_has_authenticated` to hide the first-time explainer, so after logout it still looks like a returning/remembered session instead of a clean login page.

Plan:

1. Stop saving manager numbers as the device-bound phone
   - Update `src/pages/MerchantManagerLoginPage.tsx` so manager sign-in no longer writes `mfs_device_phone`.
   - Keep only the minimum “manager has signed in before” UX if needed, but do not store/prefill the phone number.

2. Clear manager-only UI state on manual logout
   - Update `src/pages/MerchantDashboard.tsx` logout handling so when a staff/manager logs out it clears manager-specific local state and trusted-device token for the current manager phone where possible.
   - Keep owner logout behavior intact.

3. Make the manager login page always a clean sign-in form after logout
   - Remove the dependency on the global `mfs_has_authenticated` flag for hiding/showing the manager page explainer/footer.
   - Ensure the phone input value starts as empty on `/merchant-manager-login` every time, with placeholder `01XXXXXXXXX` and prefix `+88`.

4. Prevent future cross-contamination between owner and manager login
   - Use manager-specific keys only for manager UI state if any is still required.
   - Avoid using the owner/wallet device-bound phone key for manager login.

5. Add/adjust tests
   - Add coverage that visiting `/merchant-manager-login` with existing localStorage does not prefill or show a saved manager phone.
   - Add coverage that manager logout redirects to `/merchant-manager-login` and clears manager login state.

Result: after a manager logs out, they will land on the manager login page as a fresh/clean form, without any saved number shown or returning-user state leaking from the previous session.