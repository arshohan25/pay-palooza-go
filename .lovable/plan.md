

## Fraud Management Enhancement: Auto-Rules, Escalation Workflow, and Accurate Stats

### Summary
Three interconnected improvements to the fraud system: (1) configurable auto-lock rules that trigger when thresholds are breached, (2) a resolution workflow with escalation levels, SLA timers, and team member assignment, (3) fix the AI Fraud Detection overview to only count active (open/investigating) alerts as "Critical".

---

### 1. Database Changes

**New table: `fraud_auto_rules`** — configurable triggers that auto-lock wallets
- `id` uuid PK
- `name` text (e.g. "High velocity lock")
- `metric` text (e.g. "daily_txn_count", "weekly_volume", "failed_pin_attempts", "daily_recipients")
- `threshold` numeric (the value that triggers the rule)
- `action` text (default "lock_account" — could support "lock_send_money", "flag_only")
- `lock_duration` text (e.g. "permanent", "24h", "7d")
- `is_active` boolean default true
- `created_by` uuid, `created_at`, `updated_at`
- RLS: admin read/write

**New table: `fraud_auto_rule_logs`** — records when an auto-rule fires
- `id` uuid PK
- `rule_id` uuid FK → fraud_auto_rules
- `user_id` uuid
- `metric_value` numeric (the actual value that breached the threshold)
- `action_taken` text
- `created_at` timestamptz

**Alter `fraud_alerts` table** — add escalation and SLA columns:
- `escalation_level` integer default 1 (1=L1, 2=L2, 3=L3-critical)
- `sla_deadline` timestamptz (auto-set based on severity: critical=1h, high=4h, medium=24h, low=72h)
- `escalated_at` timestamptz
- `assigned_to_team_member` uuid FK → team_members(id) (nullable)

---

### 2. Edge Function: `evaluate-fraud-rules`
A scheduled function (or called after transactions via trigger) that:
- Reads all active `fraud_auto_rules`
- For each rule, queries the relevant metric (e.g. count transactions in last 24h per user)
- If threshold breached: auto-locks the wallet via `feature_locks` insert, creates a `fraud_alerts` row, logs to `fraud_auto_rule_logs`, sends admin notification
- Scheduled via pg_cron every 15 minutes

---

### 3. Frontend Changes

**New component: `AdminFraudAutoRules.tsx`**
- CRUD interface for auto-rules (name, metric dropdown, threshold input, action, duration, active toggle)
- Table showing all rules with enable/disable toggle
- Log viewer showing recent auto-triggered actions

**Update `AdminFraudAlerts.tsx`** — Escalation & Assignment workflow:
- Add "Assign To" dropdown (team members) in alert details
- Show escalation level badge (L1/L2/L3) on each alert card
- Display SLA countdown timer (red when breached)
- "Escalate" button to bump level and shorten SLA
- Auto-set SLA deadline when alert is created (based on severity)

**Update `AdminAiFraudDetection.tsx`** — Fix stats:
- Change "Critical" stat to only count alerts where `severity = 'critical' AND status IN ('open', 'investigating')`
- Add "Active Critical" label to clarify
- Optionally add a 5th stat card for "SLA Breached" count

**Update `AdminDashboard.tsx`**:
- Add "Auto Rules" sub-tab under the Pro Fintech / Risk section

---

### 4. Files to Create/Modify

| File | Action |
|---|---|
| New migration SQL | Create `fraud_auto_rules`, `fraud_auto_rule_logs`, alter `fraud_alerts` |
| `supabase/functions/evaluate-fraud-rules/index.ts` | New edge function |
| `src/components/admin/AdminFraudAutoRules.tsx` | New component |
| `src/components/admin/AdminFraudAlerts.tsx` | Add assignment, escalation, SLA |
| `src/components/admin/AdminAiFraudDetection.tsx` | Fix critical stat filter |
| `src/pages/AdminDashboard.tsx` | Add Auto Rules tab |

### Technical Details
- SLA deadlines: critical=1h, high=4h, medium=24h, low=72h from `created_at`
- Escalation: L1→L2 halves remaining SLA, L2→L3 sets 30min SLA and sends urgent admin notification
- The `evaluate-fraud-rules` function runs every 15 min via pg_cron, uses service_role key
- Auto-rule metrics supported: `daily_txn_count`, `weekly_volume`, `daily_recipients`, `failed_pin_attempts`, `device_count`
- RLS on new tables: admin-only via `has_role()`

