

# Per-User Feature Visibility Control System

## Problem
Currently all feature toggles are global — every user sees the same set of features. The user wants certain Account page features (Icon Size, Grid Layout, Compact Mode, View Onboarding, Become a Merchant, Live Chat) hidden from new users, with admin controls to manage visibility per user, by group, or by usage badge.

## Architecture

### New Database Table: `user_feature_overrides`
Stores per-user or per-group feature visibility overrides that take priority over global toggles.

```text
user_feature_overrides
├── id (uuid, PK)
├── user_id (uuid, nullable — null = group rule)
├── feature_key (text, FK → global_feature_toggles.feature_key)
├── visibility (text: 'visible' | 'disabled' | 'hidden')
├── group_type (text, nullable: 'usage_badge' | 'role' | null)
├── group_value (text, nullable: e.g. 'new', 'basic', 'active', 'power')
├── created_by (uuid)
├── created_at (timestamptz)
```

**Resolution order**: user-specific override → group override → global toggle.

### Usage Badges (computed, not stored)
Classify users by account age and transaction count:
- **New** — account < 7 days old
- **Basic** — 7-30 days, < 10 transactions
- **Active** — 30+ days or 10+ transactions
- **Power** — 90+ days and 50+ transactions

A DB function `get_user_usage_badge(p_user_id uuid)` computes this from `profiles.created_at` and transaction count.

### Default Rules for New Users
On migration, insert group-level override rows that hide these features for "new" badge users:
- `account_icon_size` → hidden
- `account_grid_layout` → hidden
- `account_compact_mode` → hidden
- `account_onboarding` → hidden
- `account_become_merchant` → hidden
- `account_live_chat` → hidden

## Changes

### 1. Database Migration
- Create `user_feature_overrides` table with RLS (admin-only write, authenticated read for own rows)
- Create `get_user_usage_badge(uuid)` function
- Create `get_user_feature_visibility(uuid, text)` function that checks override → group → global
- Insert default "new user" group rules
- Enable realtime on the table

### 2. `src/hooks/use-global-toggles.ts`
- After loading global toggles, also fetch the user's applicable overrides (user-specific + matching group rules based on their usage badge)
- Merge overrides on top of global toggles in `isDisabled()` and `isHidden()` logic

### 3. New Admin Component: `src/components/admin/AdminUserFeatureAccess.tsx`
Admin panel with:
- **Tab 1: By Usage Badge** — grid showing feature keys vs badges (New/Basic/Active/Power), toggle visibility per cell
- **Tab 2: By Role** — same grid but for roles (User/Agent/Distributor/etc.)
- **Tab 3: Individual Users** — search by phone, see & override specific user's feature access
- **Bulk actions**: select multiple features → set visibility for a badge/role group
- Shows current override count per group

### 4. Wire into Admin Dashboard
- Add the new component as a sub-tab or section within the existing Feature Toggles admin module

## Files Changed
- **Migration SQL** — new table, functions, default data, RLS policies
- `src/hooks/use-global-toggles.ts` — merge per-user/group overrides
- `src/components/admin/AdminUserFeatureAccess.tsx` — new admin panel
- `src/components/admin/AdminGlobalToggles.tsx` — add link/tab to user-level access panel
- `src/pages/AdminDashboard.tsx` — register new admin component (if needed)

