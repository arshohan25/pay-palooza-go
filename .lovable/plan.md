## Replace back arrow with Logout in Merchant Dashboard header

The marked button (top-left arrow ←) on `/merchant` currently navigates back to `/`. You want it to trigger logout instead.

### Heads-up
A `Logout` button already exists on the right side of the same header (next to the menu icon). After this change, the header would show **two logout controls**. Two options:

1. **Replace left arrow + remove right Logout button** (recommended — cleaner, single logout entry point on the left)
2. **Replace left arrow only** (keeps both — redundant but matches the literal request)

I'll proceed with **option 1** unless you say otherwise in your approval.

### Change

In `src/pages/MerchantDashboard.tsx` (line ~415):

- Swap the left `ArrowLeft` icon button so it opens the existing logout confirmation (`setShowLogoutConfirm(true)`) instead of `navigate("/")`. Use the `LogOut` icon with a small "Logout" label, styled to match the existing glass-hero pill.
- Remove the duplicate right-side Logout `motion.button` (lines ~425–433).
- Keep the Refresh and Menu buttons on the right untouched.

No other files affected. The existing logout confirmation dialog and handler remain unchanged.