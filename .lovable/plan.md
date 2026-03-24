

## Plan: Advanced Team Member Permission System

### Problem
Currently, permissions are only configurable **after** a team member is created (via the Shield icon). The system has 3 permission levels (View, Edit, Delete) across 26 sections, but lacks:
- A **"Create/Add"** permission (separate from Edit)
- Ability to set permissions **during member creation**
- **Role-based presets** (e.g., "Support Agent" gets support + live_chat; "Finance" gets treasury + settlements)
- **Bulk actions** (grant all view, revoke all, etc.)
- Coverage for **all admin sections** (missing: live_chat, tickets, settlements, ecommerce, security, marketing, careers, savings, loans, insurance, gift_cards, donations, etc.)

### Changes

#### 1. Database Migration
Add `can_add` column to `team_access_permissions`:
```sql
ALTER TABLE team_access_permissions ADD COLUMN IF NOT EXISTS can_add boolean DEFAULT false;
```

#### 2. Expand SECTIONS list (AdminTeamManagement.tsx)
Add missing admin sections to cover the full dashboard:
```
"live_chat", "tickets", "settlements", "ecommerce", "security", "marketing",
"careers", "savings", "loans", "insurance", "gift_cards", "donations",
"merchants", "agents", "distributors", "float", "inventory", "sessions",
"devices", "blacklist", "system_health", "data_export"
```
Total: ~48 sections grouped into categories for easier navigation.

#### 3. Permission Presets (AdminTeamManagement.tsx)
Add role-based preset templates that auto-fill permissions:

| Preset | Sections with Full Access | View-Only |
|--------|--------------------------|-----------|
| Support Agent | support, live_chat, tickets | users, transactions, orders |
| Compliance Officer | kyc, auditlog, security, blacklist, fraud | users, transactions |
| Finance Manager | treasury, settlements, commissions, charges, float | transactions, reporting |
| Operations | orders, ecommerce, inventory, merchants, agents | overview, reporting |
| Full Access | All sections | - |
| View Only | - | All sections |

#### 4. Enhanced Add Member Dialog (AdminTeamManagement.tsx)
Convert the "Add Member" dialog into a **2-step flow**:
- **Step 1**: Basic info (username, password, name, role, department, email) -- existing
- **Step 2**: Permission configuration with preset selector + granular checkboxes
  - Dropdown to pick a preset (auto-fills the grid)
  - Same View/Add/Edit/Delete grid as the edit dialog
  - "Skip (use defaults)" button to use current behavior

#### 5. Enhanced Edit Permissions Dialog (AdminTeamManagement.tsx)
- Add `can_add` column (4 columns: View, Add, Edit, Delete)
- Add preset selector at top for quick reconfiguration
- Group sections by category with collapsible headers (Operations, Financial, Network, etc.)
- Add bulk action buttons: "Grant All View", "Revoke All", "Full Access"
- Show permission summary count (e.g., "18/48 sections accessible")

#### 6. Permission Summary on Member Cards (AdminTeamManagement.tsx)
Show a compact badge on each member card:
```
[View: 26] [Edit: 8] [Delete: 3]
```

#### 7. Access Matrix Enhancement (AdminTeamManagement.tsx)
- Add the `can_add` icon (Plus) alongside View/Edit/Delete icons
- Group sections by category with visual separators

### Technical Details

**Files modified:**
- `src/components/admin/AdminTeamManagement.tsx` -- main changes (presets, 2-step add flow, enhanced edit dialog, expanded sections, bulk actions)

**Database migration:**
- Add `can_add` boolean column to `team_access_permissions`

**No new files needed.** All changes are within the existing component and database table.

### Section Categories for Grouped Display
```text
Operations:    overview, users, transactions, orders, ecommerce, inventory
Financial:     treasury, settlements, commissions, charges, float, savings, loans, donations
Network:       merchants, agents, distributors, referrals
Services:      recharge, billers, insurance, gift_cards
Support:       support, live_chat, tickets, disputes
Security:      security, kyc, locks, blacklist, sessions, devices, fraud
System:        toggles, gateways, webhooks, apihub, system_health, data_export
Admin:         team, permissions, auditlog, banners, limits, reporting, marketing, careers
```

