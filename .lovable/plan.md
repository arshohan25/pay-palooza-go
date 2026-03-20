

## Make All Merchant Dashboard Features Open Full-Screen

### Problem
Currently, only the "Inbox" tab opens as a full-screen overlay. All other features (Products, Orders, Store, Analytics, Transactions, QR, API, Pay Links, Settlements, MDR) render below the header/stats/tabs, which takes up valuable screen space.

### Solution
When any tab other than "overview" is active, render it as a full-screen overlay (like the inbox already does), with a back button to return to the overview. The header, stats grid, and tab strip will be completely hidden.

### Changes to `src/pages/MerchantDashboard.tsx`

1. **Wrap all non-overview tabs in full-screen overlays**: Replace the current content section (lines ~411-427) so that when `activeTab !== "overview"`, the selected tab component renders in a `fixed inset-0 z-[70] bg-background` container — identical to how the inbox works.

2. **Add a consistent back-header** to each full-screen view: A top bar with a back arrow and the tab's label (e.g. "Products", "Analytics"), so users can return to the overview.

3. **Keep the overview tab rendering normally** within the existing layout (header + stats + tabs visible).

4. **Menu drawer items** already call `setActiveTab(...)` and close the menu — they will now automatically trigger full-screen mode.

### Technical Details
- The full-screen container pattern already exists for `inbox` (lines 397-408). We extend this to all other tabs.
- Each full-screen view gets: `<div className="fixed inset-0 z-[70] bg-background flex flex-col">` with a header bar containing back button + title, then the tab content in a scrollable area.
- The main tab strip buttons for Products/Orders/Store will also trigger full-screen since they set `activeTab`.
- No new files needed — single file edit to `MerchantDashboard.tsx`.

