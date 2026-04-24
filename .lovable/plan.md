## Plan: Add All Recommended Future Enhancements to the Admin Panel

### Goal
Implement a production-style **Admin Command Intelligence Upgrade** that adds the requested user management, analytics, security, customization, and feature-launch enhancements while preserving the current dark glassmorphism admin design and existing role-based access patterns.

Because this is a large admin expansion, I will implement it as a set of connected admin modules, with real database-backed records where persistence/audit is required and safe calculated dashboards where data already exists.

---

## 1. New Admin Navigation Modules

Add these modules to the Admin sidebar:

- **User Intelligence**
- **Business Intelligence**
- **Approval Queue**
- **Security Policies**
- **Launch Control**
- **Data Quality**
- **Evidence Vault**
- **Segments**
- **Bulk Actions**
- **Customization**

The existing modules will remain unchanged, and the nav reorder system will automatically append the new modules for existing admins.

---

## 2. User Intelligence Center

Create a dedicated admin screen for 360-degree user review:

- Search by name, phone, user ID, wallet ID
- Profile summary with KYC, account status, balance, account age, and account health
- Automatically calculated **risk score** with labels:
  - Low Risk
  - Watchlist
  - High Risk
  - Restricted
  - Investigation Required
- Timeline combining available records from:
  - profile changes / audit logs
  - KYC records
  - device registrations
  - login/session events
  - transactions
  - feature locks
  - fraud alerts
  - PIN changes
  - support tickets/conversations
  - merchant/agent relationship records
  - referrals
  - orders
  - wallet balance activity
- Admin notes and internal case history
- Follow-up reminders and assigned staff
- Quick lifecycle actions:
  - suspend/reactivate
  - lock features
  - request KYC resubmission
  - add to watchlist
  - revoke device
  - export user intelligence snapshot

### Risk score logic
Use a transparent scoring model based on available signals:

- failed OTP/login events
- device count/changes
- transaction velocity/high-value transfers
- blacklist/fraud alerts
- KYC rejection status/history
- chargeback/dispute activity
- account age
- restricted/suspended profile state

The UI will show both the score and the contributing reasons so admins can understand why a user is flagged.

---

## 3. User Segmentation Builder

Create a new segment builder screen with ready-made segment templates:

- New users with no first transaction
- High-balance dormant users
- Frequent recharge users
- Merchants with declining sales
- Agents with low float
- Users with rejected KYC
- Power users eligible for rewards
- Suspicious users requiring review

Admins will be able to:

- preview matching users
- save segment definitions
- export segment users
- use saved segments as a source for notifications, bulk actions, feature unlocks, and promotion targeting

---

## 4. Bulk User Action Center

Add a dedicated bulk action command center for selected users/segments:

- suspend users
- reactivate users
- unlock/lock features
- assign badge/label
- send notification
- export selected users
- request KYC resubmission
- revoke devices
- apply custom limits
- add to watchlist

Each action will include:

- confirmation dialog
- required reason field for sensitive actions
- audit log entry
- rollback metadata where practical
- option to route high-risk actions through Approval Queue

---

## 5. Executive Business Intelligence Dashboard

Add a consolidated analytics dashboard with:

- total processed volume
- net revenue
- daily/monthly active users
- new users
- KYC conversion rate
- failed transaction rate
- fraud rate
- merchant GMV
- agent liquidity health
- recharge volume
- loan status
- gift card sales
- e-commerce order volume

Also add analytics sections for:

- cohort analytics: D1/D7/D30 retention, KYC completion, first transaction conversion
- funnel analytics: user onboarding, merchant funnel, agent funnel
- revenue attribution by transaction type, segment, merchant category, network, gateway, and feature usage
- predictive cards for churn risk, inactive merchants, low-float agents, support demand, fraud forecast, and revenue forecast
- real-time operations wall mode for command-center monitoring

---

## 6. Approval Queue and Four-Eyes Workflow

Create a database-backed approval workflow for sensitive actions:

- delete user
- force KYC approval
- large limit increase
- gateway config changes
- fee changes
- merchant payout changes
- admin role assignment
- data export
- bulk suspension
- blacklist removal

Flow:

```text
Admin A requests action
  -> Approval Queue records pending request
  -> Admin B reviews and approves/rejects
  -> Approved action executes or is marked ready for execution
  -> Audit log records requester, reviewer, decision, reason, and payload
```

To avoid unsafe privilege escalation, role/admin checks will use existing server-side role validation patterns, not client-side storage.

---

## 7. Security Policy Center

Add configurable admin security policies:

- require 2FA for admin roles
- block admin login from unknown devices
- restrict admin access by IP
- auto-expire inactive staff accounts
- require reason for sensitive actions
- limit export frequency
- require approval for permission changes
- temporary access grants with expiry
- per-module read/create/update/delete/export/approve permission matrix
- permission change history
- “view as staff member” simulator for permission review

Also add monitoring panels for:

- new admin device login alerts
- impossible-travel style warnings using available IP/location metadata
- after-hours login warnings
- excessive export attempts
- repeated failed staff login attempts
- admin account risk score
- sensitive data access logs

---

## 8. Sensitive Data Access Logs and Evidence Vault

Add compliance-grade records for sensitive views and exports:

- KYC documents / NID / passport fields
- bank details
- phone numbers
- device fingerprints
- transaction history
- deleted user snapshots
- exported reports

Create an **Evidence Vault** for:

- LEA requests
- audit exports
- approval records
- sensitive access logs
- report hashes
- investigation notes
- evidence timeline

---

## 9. Data Quality Monitor

Add a screen that highlights operational data gaps:

- users without profiles
- profiles without KYC records
- merchants without stores
- agents without float
- orders without settlement status
- transactions missing fees
- failed webhook delivery
- duplicate phone/device records

Each issue group will show counts, samples, severity, and suggested remediation.

---

## 10. Admin Customization and Role-Based Homepages

Add admin personalization features:

- dashboard layout builder with draggable cards
- custom widgets per role
- saved dashboard layouts
- department-specific homepages:
  - Support
  - Finance
  - Risk/Compliance
  - Marketing
  - Operations
- favorite modules
- recently used tools
- saved filters

Persist user-specific admin preferences locally first where safe, and use the backend for shared/team-level settings.

---

## 11. Feature Launch Control Room

Extend the current **Advance for Future** system into a launch control room:

- launch calendar
- scheduled preview date
- scheduled live date
- owner assignment
- dependency status
- rollback plan
- business impact estimate
- launch notes
- checklist
- existing emulator preview integration
- audit trail

This will build on the current preview/launch/hide functionality instead of replacing it.

---

## 12. White-Label, Brand, and Template Controls

Add customization screens for:

- app logo/splash metadata preview
- primary color preview
- festival theme defaults
- merchant storefront themes
- receipt branding
- invoice branding
- notification language/tone
- role-specific PWA branding previews

Add a notification template builder for:

- OTP messages
- transaction alerts
- KYC approval/rejection
- merchant approval
- agent onboarding
- support ticket updates
- loan reminders
- donation receipts
- recharge confirmation
- fraud warnings

Support English/Bengali versions and a preview before saving.

---

## Technical Implementation

### Frontend files to add
New admin components such as:

- `AdminUserIntelligenceCenter.tsx`
- `AdminBusinessIntelligence.tsx`
- `AdminApprovalQueue.tsx`
- `AdminSecurityPolicyCenter.tsx`
- `AdminDataQualityMonitor.tsx`
- `AdminEvidenceVault.tsx`
- `AdminUserSegmentationBuilder.tsx`
- `AdminBulkUserActionCenter.tsx`
- `AdminCustomizationCenter.tsx`
- `AdminLaunchControlRoom.tsx`

### Existing files to update

- `src/pages/AdminDashboard.tsx`
  - add imports
  - add nav items
  - route active tabs to new modules
- `src/hooks/use-admin.ts`
  - add safe helper fetchers/actions where useful
- `src/components/admin/AdminAdvanceForFuture.tsx`
  - connect Launch Control entry points where needed

### Backend/database changes required
Use Lovable Cloud migrations for persistent admin governance data:

- `admin_user_notes`
- `admin_user_segments`
- `admin_bulk_actions`
- `admin_approval_requests`
- `admin_security_policies`
- `admin_sensitive_access_logs`
- `admin_evidence_vault`
- `admin_dashboard_layouts`
- `admin_launch_calendar`
- `notification_templates`
- optional rollback/audit metadata tables if not covered by existing `audit_logs`

All new tables will have RLS enabled. Admin/staff access will be controlled through server-side role checks and existing role patterns. No roles will be stored on profiles/users.

### Safety rules

- Sensitive actions will require reason fields.
- High-impact actions will be routed to Approval Queue.
- Every sensitive read/write will create an audit/access record.
- Existing hard delete and role workflows will not be weakened.
- No anonymous signups or client-side admin checks will be introduced.

---

## Expected Result

After implementation, the admin panel will include a full command-center layer:

- one-screen user intelligence and lifecycle review
- automated risk/health scoring
- saved user segments and bulk operations
- executive analytics, cohorts, funnels, attribution, predictions, and operations wall
- two-admin approval queue for sensitive changes
- stronger admin security policy management
- sensitive data access logs and evidence vault
- data quality monitoring
- role-based/customizable admin dashboards
- launch calendar/control room for future features
- brand and notification template customization controls