

## Issue: Advanced Modules Not Visible

After inspecting the code and attempting to view the admin page in the browser, here's what I found:

**All 5 advanced modules ARE correctly wired in the code:**
- Imports exist (lines 71-75)
- NAV_ITEMS entries exist (lines 211-215): AI Fraud, Geo Track, Routing, Liquidity, Live Monitor
- Rendering blocks exist (lines 1370-1383)
- Sidebar uses `overflow-y-auto` so it scrolls

**The real issue:** These 5 items are at the very bottom of a 35+ item sidebar list. On a 638px viewport, the sidebar can only show ~15-16 items without scrolling. Users must scroll down past Trash to see them.

### Proposed Fix: Reorganize the Sidebar with Grouped Sections

Instead of one flat list, group the NAV_ITEMS into collapsible sections with headers, and move the advanced modules into a prominent "Advanced" section:

1. **In `AdminDashboard.tsx`**, restructure `NAV_ITEMS` into grouped sections:
   - **Overview**: Dashboard, Users, Alerts
   - **Operations**: Transactions, Deposits, Disputes, Support, KYC, Orders, Fund Requests
   - **Financial**: Commission, Charges, Settlements, Bank Recon, Treasury, Savings
   - **Network**: Agent Hub, Wallets, Merchants, Referrals
   - **System**: Gateways, Toggles, Locks, Permissions, Security, Settings, API Hub, Webhooks, Billers, Recharge
   - **Marketing**: Marketing, Banners, Loyalty, Notify
   - **Reports**: Reports, Adv. Reports, Audit Log
   - **Pro Fintech** (highlighted): AI Fraud, Geo Track, Smart Routing, Liquidity, Live Monitor
   - **Other**: Team, Trash

2. **Render each group** with a small uppercase label header and a divider. All groups are expanded by default — no collapsing needed, just visual grouping.

3. **Add a "⭐ Pro" badge** next to the "Pro Fintech" section header to make it stand out.

This is a single-file change to `AdminDashboard.tsx` — restructuring the `NAV_ITEMS` array into a grouped format and updating the `navContent` render block.

