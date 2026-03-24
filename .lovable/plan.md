

## Plan: Per-Role Session Timeouts with Redesigned UI

### What Changes

**1. Replace single "User Session Timeout" with per-role timeouts**

Currently there's one shared timeout for all non-team users. This will be split into 5 separate configurable timeouts:
- **User** (regular users)
- **Agent**
- **Distributor**
- **Super Distributor**
- **Merchant**

Each stored as a separate key in `global_feature_toggles`:
- `user_timeout_minutes`
- `agent_timeout_minutes`
- `distributor_timeout_minutes`
- `super_distributor_timeout_minutes`
- `merchant_timeout_minutes`

**2. Redesigned Admin UI** (`src/components/admin/AdminSystemSettings.tsx`)

Replace the two separate timeout cards with a single unified "Session Timeout Management" card featuring:
- A clean header with icon and description
- A table/grid layout showing each role with its own timeout dropdown in a row
- Roles listed: Team Members, Users, Agents, Distributors, Super Distributors, Merchants
- Each row has: role icon + name, current timeout dropdown
- Compact, scannable design — all timeouts visible at a glance

**3. Update hook** (`src/hooks/use-user-session-timeout.ts`)

- Accept an optional `role` parameter: `useUserSessionTimeout(role?: string)`
- Based on the role, read the matching config key (e.g., `agent_timeout_minutes`)
- Fall back to `user_timeout_minutes` if no role-specific key exists
- Default remains 30 minutes

**4. Wire role-specific timeouts into dashboards**

Each dashboard passes its role to the hook:
- `src/pages/Index.tsx` → `useUserSessionTimeout("user")`
- `src/pages/AgentDashboard.tsx` → `useUserSessionTimeout("agent")`
- `src/pages/DistributorDashboard.tsx` → `useUserSessionTimeout("distributor")`
- `src/pages/SuperDistributorDashboard.tsx` → `useUserSessionTimeout("super_distributor")`
- `src/pages/MerchantDashboard.tsx` → `useUserSessionTimeout("merchant")`

### UI Design (Redesigned Card)

```text
┌──────────────────────────────────────────────────┐
│ 🕐 Session Timeout Management                    │
│ Configure auto-logout duration per role           │
│                                                   │
│  Role                    Timeout                  │
│  ─────────────────────── ──────────────────────── │
│  👥 Team Members         [  30 minutes      ▾ ]  │
│  👤 Users                [  30 minutes      ▾ ]  │
│  🏪 Agents               [  1 hour          ▾ ]  │
│  📦 Distributors         [  2 hours         ▾ ]  │
│  🏢 Super Distributors   [  2 hours         ▾ ]  │
│  🛍️ Merchants            [  1 hour          ▾ ]  │
└──────────────────────────────────────────────────┘
```

### Files Modified
- `src/components/admin/AdminSystemSettings.tsx` — redesign timeout UI into single unified card with per-role dropdowns
- `src/hooks/use-user-session-timeout.ts` — accept `role` param, read role-specific config key
- `src/pages/Index.tsx` — pass `"user"` to hook
- `src/pages/AgentDashboard.tsx` — pass `"agent"`
- `src/pages/DistributorDashboard.tsx` — pass `"distributor"`
- `src/pages/SuperDistributorDashboard.tsx` — pass `"super_distributor"`
- `src/pages/MerchantDashboard.tsx` — pass `"merchant"`

