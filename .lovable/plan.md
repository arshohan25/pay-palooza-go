

## Add Theme Toggle + Notification Badges to Admin Dashboard

### Changes — Single File: `src/pages/AdminDashboard.tsx`

#### 1. Theme Toggle in Header
Add a Sun/Moon toggle button next to the Refresh and Activity buttons in the top header bar. Uses `useTheme` from `next-themes` (already used elsewhere in the app).

**Location**: Lines 883-894 area, add before/after the refresh button.

#### 2. Real-time Notification Badges on Sidebar Nav Items
Currently badges exist for: `alerts`, `support`, `kyc`, `toggles`. Add badges for:

- **Complaints** (`complaints`): Count of open/in-progress complaints from `support_complaints`
- **Fund Requests** (`fund_requests`): Already have `pendingFundCount` state — wire it to the nav badge
- **Merchant Apps** (`merchant_apps`): Count of pending merchant applications
- **API Requests** (`api_requests`): Count of pending API requests
- **Orders** (`orders`): Count of pending orders

Each count fetched via a simple `select("id", { count: "exact", head: true })` query with real-time listener, following the existing pattern used for `disabledTogglesCount`.

### Technical Details

| What | How |
|------|-----|
| Theme toggle | Import `useTheme` from `next-themes`, add `Sun`/`Moon` icons (already imported in other files) |
| Complaint count | `supabase.from("support_complaints").select(...).in("status", ["open","in_progress"])` |
| Fund request badge | Reuse existing `pendingFundCount` state |
| Merchant apps count | `supabase.from("merchant_applications").select(...).eq("status","pending")` |
| API requests count | `supabase.from("api_key_requests").select(...).eq("status","pending")` |
| Real-time updates | Add listeners to existing `admin-global-realtime` channel or dedicated small channels |

### Files Changed

| File | Action |
|------|--------|
| `src/pages/AdminDashboard.tsx` | **Edit** — add theme toggle + badge counts + nav badge rendering |

