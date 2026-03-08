

## Team Activity Dashboard + Support Agent Routing

### Overview
Two features: (1) A "Dashboard" tab in the Team Management panel showing real-time activity metrics, login history, and performance stats per team member. (2) Automatic support agent routing that assigns new support conversations to the least-busy available team member in the "support" department.

### Changes

**1. Expand `AdminTeamManagement.tsx` tabs from 2 to 3**
- Add a "Dashboard" tab alongside "Members" and "Access Matrix"
- Dashboard tab renders the new `TeamActivityDashboard` component

**2. New component: `src/components/admin/TeamActivityDashboard.tsx`**
- **Summary cards**: Total team members, online count, avg actions/day, open support tickets
- **Per-member performance table**:
  - Name, department, availability status
  - Actions today / this week (count from `audit_logs` where `actor_id` = member's `user_id`)
  - Last active timestamp (from `team_members.last_active_at`)
  - Open support tickets assigned (count from `support_conversations` where status = 'open')
- **Activity timeline**: Real-time feed of recent team actions from `audit_logs` filtered to team member actor_ids, with Supabase realtime subscription
- **Login history section**: Query `audit_logs` for `action = 'login'` events per team member (we'll instrument login tracking in the auth flow)
- Filterable by department, date range

**3. New component: `src/components/admin/SupportAgentRouter.tsx`**
- Utility hook `useAgentRouting()` that:
  - Fetches available support-department team members (`team_members` where `department = 'support'` AND `is_available = true`)
  - Counts their current open assigned conversations
  - Returns the least-busy available agent
- Exposed as a "Route to Agent" button in the Support Dashboard conversation list
- When clicked, updates `support_conversations` to assign the conversation (we'll use the existing `assigned_to` field or add a column if needed—checking schema... `support_conversations` doesn't have an `assigned_to` column)

**4. Database migration**
- Add `assigned_agent_id uuid` column to `support_conversations` for agent routing
- Enable realtime on `team_members` table (already done in prior migration)

**5. Update `AdminSupportDashboard.tsx`**
- Import agent routing hook
- Show assigned agent badge on each conversation
- Add "Auto-Assign" button that picks the least-busy available support agent
- When a new conversation arrives (realtime INSERT), auto-route if enabled

**6. Update `team_members.last_active_at`**
- In `AdminDashboard.tsx` mount, upsert `last_active_at = now()` for the current user's team_members row (acts as login tracking)
- Insert an `audit_logs` entry with `action = 'admin_login'` on dashboard mount (deduplicated per session)

### No new tables needed — uses existing `audit_logs`, `team_members`, `support_conversations` (+ new column).

