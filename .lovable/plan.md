

## Add Missing Essential Admin Panel Modules

### Audit Results

After cross-referencing all 68 admin components, the nav groups, render blocks, and database tables, here are the gaps:

**A. Imported but NOT in nav sidebar (partially hidden):**
- `AdminDepositAccounts` — rendered inside `fund_requests` tab but has no dedicated nav entry, making it hard to discover

**B. Essential modules that don't exist:**

| Module | Why Essential |
|--------|-------------|
| **Complaint Manager** | `support_complaints` table exists with priority, status, resolution_notes — but no dedicated admin UI to manage complaints separately from chat |
| **Device Manager** | `device_registrations` table exists (fingerprints, user devices) — visible in UserSessions but no dedicated management UI for blocking/revoking devices |
| **Savings Auto-Save Monitor** | `savings_auto_save` table has schedules, frequencies, settlement status — admins have savings goals view but no auto-save oversight |
| **OTP & PIN Monitor** | `otp_codes` and `pin_reset_attempts` tables exist — no admin visibility into OTP abuse or PIN reset patterns |
| **Commission Ledger Viewer** | `commission_logs` table tracks per-transaction commission splits — no admin UI to review actual commission payouts |
| **Platform Announcements** | Admins can send notifications but there's no persistent announcement/maintenance banner system for the platform |

### Implementation Plan

#### 1. AdminComplaintManager.tsx (New)
- List all `support_complaints` with filters: status (open/in_progress/resolved), priority (low/medium/high/urgent)
- Assign complaints to team members, update status, add resolution notes
- Summary cards: Open, In Progress, Resolved, Avg Resolution Time
- Add to **Operations** nav group

#### 2. AdminDeviceManager.tsx (New)
- List `device_registrations` with user phone/name resolution from profiles
- Show fingerprint, user_agent, created_at
- Action: Revoke/delete device registration (forces re-verification)
- Flag users with 3+ devices as suspicious
- Add to **System** nav group

#### 3. AdminAutoSaveMonitor.tsx (New)
- List all `savings_auto_save` records with user info
- Show frequency, amount, next_run_at, last_run_at, settled status
- Toggle active/inactive, summary stats (total scheduled, total amount/month)
- Add to **Financial** nav group

#### 4. AdminOtpMonitor.tsx (New)
- Query `audit_logs` filtered for OTP/PIN actions (send_otp, pin_reset, verify_otp)
- Show hourly/daily OTP request volume, top requesting phones
- Flag abuse patterns (5+ OTP requests in 1 hour from same phone)
- Add to **System** nav group

#### 5. AdminCommissionLedger.tsx (New)
- List `commission_logs` with transaction details
- Show agent/distributor/master_distributor/company splits per transaction
- Filter by date range, txn_type, agent
- Summary: Total commissions paid, by role breakdown
- Add to **Financial** nav group

#### 6. Wire AdminDepositAccounts into nav
- Add `deposit_accounts` entry to **Financial** nav group (currently hidden inside fund_requests)
- Add separate render block

### Files Changed

| File | Action |
|------|--------|
| `src/components/admin/AdminComplaintManager.tsx` | **Create** |
| `src/components/admin/AdminDeviceManager.tsx` | **Create** |
| `src/components/admin/AdminAutoSaveMonitor.tsx` | **Create** |
| `src/components/admin/AdminOtpMonitor.tsx` | **Create** |
| `src/components/admin/AdminCommissionLedger.tsx` | **Create** |
| `src/pages/AdminDashboard.tsx` | **Edit** — Add 5 new nav items + render blocks, wire deposit_accounts separately |

No database migrations needed — all modules use existing tables.

