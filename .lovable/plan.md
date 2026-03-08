

## Role-Based Team Management System

### What We're Building
A comprehensive **Team Management** panel in the Admin Dashboard where admins can:
- Invite/create team member accounts (support agents, compliance officers, finance staff)
- Assign and revoke roles
- Set granular access permissions per admin section
- Toggle team member availability/active status
- Monitor team activity and last-seen timestamps
- View and audit team member actions

### Database Changes

**1. New table: `team_members`** — tracks staff metadata beyond what `user_roles` provides:
```sql
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  department text DEFAULT 'general',
  is_available boolean DEFAULT true,
  last_active_at timestamptz,
  created_by uuid,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
```

**2. New table: `team_access_permissions`** — granular section-level access control:
```sql
CREATE TABLE public.team_access_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  section text NOT NULL,          -- e.g. 'users', 'transactions', 'treasury', 'support'
  can_view boolean DEFAULT true,
  can_edit boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  granted_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, section)
);
ALTER TABLE public.team_access_permissions ENABLE ROW LEVEL SECURITY;
```

RLS: Admin-only CRUD using `has_role(auth.uid(), 'admin')`. Team members can SELECT own permissions.

### Frontend Changes

**1. New nav item in `AdminDashboard.tsx`**: Add "Team" tab with `UsersRound` icon to `NAV_ITEMS`.

**2. New component: `src/components/admin/AdminTeamManagement.tsx`**:
- **Team Overview**: List of all team members with role badges, availability toggle, last active time
- **Add Member**: Dialog to search existing users by phone, assign roles (compliance, finance, admin, support), set department, and configure section access
- **Edit Member**: Inline role assignment, toggle availability, update access permissions
- **Access Matrix**: Grid showing which sections each team member can view/edit/delete — checkboxes per section (users, transactions, treasury, disputes, support, KYC, etc.)
- **Remove Member**: Revoke roles and remove from team
- **Activity Log**: Filter audit_logs by team member actor_ids to show recent actions

**3. Update `src/components/admin/AdminDashboard.tsx`**:
- Import and render `AdminTeamManagement` for the "team" tab
- Optionally gate existing admin sections using `team_access_permissions` (check current user's permissions before rendering edit controls)

### Section Access Keys (matching NAV_ITEMS):
`overview`, `users`, `transactions`, `chargebacks`, `alerts`, `charges`, `commissions`, `disputes`, `support`, `locks`, `orders`, `gateways`, `toggles`, `recharge`, `kyc`, `referrals`, `treasury`, `webhooks`, `permissions`, `reporting`, `billers`, `auditlog`, `apihub`, `banners`, `limits`, `team`

### Key Features Summary
- Create/invite team members with role assignment
- Per-section view/edit/delete permission matrix
- Availability toggle (online/offline for support routing)
- Activity monitoring via audit_logs
- Bulk role management
- Department grouping
- Real-time status updates

