

## Add Hamburger Menu to Agent Dashboard

### Overview
Add a slide-out hamburger menu to the agent dashboard header, replacing the back arrow with a menu icon. The menu will contain profile management, QR sharing, customer KYC status, analytics, and other agent-relevant options.

### Changes

**`src/pages/AgentDashboard.tsx`**

1. **Replace back arrow with hamburger menu icon** (Menu from lucide-react) in the top-left of the hero header.

2. **Add hamburger menu state**: `menuOpen` boolean state to control the slide-out drawer.

3. **Create `AgentMenuDrawer` component** (inline or separate) — a left-sliding panel with these sections:

   **Profile Section (top)**
   - Agent avatar (from profile `avatar_url`) with camera icon overlay for changing photo
   - Business name + territory badge
   - Phone number
   - Tapping avatar opens a simplified avatar-only edit flow (upload to `kyc-documents` or `product-images` bucket, update `profiles.avatar_url`)

   **Menu Items:**
   | Item | Icon | Action |
   |------|------|--------|
   | Edit Avatar | Camera | Opens avatar upload sheet (crop + upload to storage, update `profiles.avatar_url`) |
   | Share QR | QrCode | Opens existing `UserQrModal` with agent's user ID and business name |
   | Customer KYC | ShieldCheck | Opens a sheet showing KYC-verified customer count from `kyc_verifications` where agent onboarded them, or navigates to a list |
   | Analytics | BarChart3 | Opens analytics sheet with: Daily volume/txns/commission, Monthly totals, All-time totals, breakdown by transaction type |
   | Transaction Limits | Gauge | Shows agent's current limits and usage |
   | Settings | Settings | Placeholder for future settings |
   | Back to Home | Home | Navigates to `/` |
   | Sign Out | LogOut | Calls `signOut()` from `useAuth` |

4. **Avatar Edit Flow**: A mini sheet that opens a file picker, previews the selected image, uploads to storage bucket, and updates `profiles.avatar_url` via Supabase update.

5. **Analytics Sheet**: A bottom sheet with tabs (Daily / Monthly / All-time) showing:
   - Total transactions count
   - Total volume (sum of amounts)
   - Total commission earned
   - Breakdown by type (Cash In, B2B, Bill Pay, etc.)
   - Data sourced from existing `recentTxns` for daily, and a broader query for monthly/all-time

6. **Customer KYC Sheet**: Shows count of customers the agent has onboarded (from `agentInfo.customers_onboarded`) and their verification status.

### UI Pattern
- Hamburger icon replaces the back arrow in the top-left
- Menu slides in from the left with backdrop overlay (consistent with existing notification panel pattern sliding from right)
- Each menu item has icon + label + optional chevron
- Uses existing design tokens: `bg-card`, `rounded-2xl`, `shadow-card`, etc.

### Files changed
| File | Change |
|------|--------|
| `AgentDashboard.tsx` | Add hamburger menu button, `AgentMenuDrawer` component, avatar edit sheet, analytics sheet, customer KYC sheet, import `UserQrModal` |

