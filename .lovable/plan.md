

## Plan: Add Essential Roles and Departments

### Current State
- **Roles** (8): admin, compliance, finance, customer, agent, merchant, distributor, super_distributor
- **Departments** (6): general, support, compliance, finance, operations, engineering

### Changes

**File: `src/components/admin/AdminTeamManagement.tsx`**

#### 1. Expand STAFF_ROLES
Add these essential roles:

| Role Value | Label |
|---|---|
| support | Support |
| operations | Operations |
| marketing | Marketing |
| hr | HR |
| audit | Auditor |
| risk | Risk Officer |
| developer | Developer |
| manager | Manager |

Total: 16 roles (8 existing + 8 new). The `AppRole` type union will be extended accordingly.

#### 2. Expand DEPARTMENTS
Add these departments:

| Department |
|---|
| marketing |
| hr |
| risk |
| audit |
| management |
| product |
| logistics |
| legal |

Total: 14 departments (6 existing + 8 new).

#### 3. Update ROLE_COLORS
Add color mappings for all new roles so badges display distinctly.

#### 4. Update Permission Presets
Add new presets matching the new roles:
- **Marketing**: marketing, banners sections with full access; reporting, ecommerce view-only
- **HR / Manager**: team, users full access; auditlog, sessions view-only
- **Risk Officer**: fraud, blacklist, security full access; transactions, kyc view-only
- **Auditor**: auditlog, transactions, reporting view-only across the board (no edit/delete)
- **Developer**: apihub, gateways, webhooks, system_health full access

### Technical Details
- Single file modified: `src/components/admin/AdminTeamManagement.tsx`
- No database changes needed — roles/departments are stored as plain strings in `team_members` and `user_roles` tables
- The local `AppRole` type union is extended (this is a UI-level type, not the DB enum)

