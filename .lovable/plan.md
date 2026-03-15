

## 🔐 Risk Control Module — Plan

### What Already Exists
- **AI Fraud Detection** (`AdminAiFraudDetection.tsx`) — risk scoring, velocity violations, pattern analysis
- **Fraud Alerts** (`AdminFraudAlerts.tsx`) — alert cards with device/IP/location data
- **Limit Manager** (`AdminLimitManager.tsx`) — global defaults, user overrides, audit trail
- **Security Center** (`AdminSecurityCenter.tsx`) — sessions, devices, IP whitelist

### What's New: `AdminRiskControl.tsx`
A unified "Risk Control" module with 5 sub-tabs that consolidates and extends existing fraud/AML capabilities:

**Tab 1: Agent Fraud** — Flags agents with abnormal behavior:
- Agents with cash-in/out volume exceeding float limits
- Agents with suspiciously high daily transaction counts
- Agents transacting outside assigned area (cross-reference `agents.territory`)
- Quick-action buttons: Freeze Agent, Investigate, View Details

**Tab 2: Suspicious Cash Out** — Monitors cash-out anomalies:
- Large single cashouts (>৳25,000)
- Repeated same-amount cashouts (smurfing detection)
- Multiple cashouts to same agent in short time
- Night-time cashouts (unusual hours)
- Data source: `transactions` table filtered by `type=cashout`

**Tab 3: AML Rules** — Anti-Money Laundering rule engine:
- Configurable rules stored in a new `aml_rules` table (rule_name, condition_type, threshold, is_active, action)
- Pre-seeded rules: Structuring detection (multiple txns just under limit), Rapid fund movement (add→send within minutes), High-value round amounts, New account high activity
- Each rule shows trigger count and last triggered time
- Toggle rules on/off, edit thresholds

**Tab 4: Transaction Limits** — Quick view of active limits with violation tracking:
- Shows all `transaction_limits` with current utilization rates
- Highlights users approaching limits (>80% used)
- Links to AdminLimitManager for full management

**Tab 5: Risk Dashboard** — Aggregate risk overview:
- Overall risk score for the platform
- Charts: risk trend (7-day), top risk categories
- Summary cards: total flagged users, active AML triggers, limit violations today

### Database Changes
One new table via migration:

```sql
CREATE TABLE aml_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name text NOT NULL,
  description text,
  condition_type text NOT NULL, -- 'structuring', 'rapid_movement', 'round_amount', 'new_account_activity'
  threshold numeric NOT NULL DEFAULT 0,
  time_window_minutes integer DEFAULT 60,
  is_active boolean NOT NULL DEFAULT true,
  action text NOT NULL DEFAULT 'flag', -- 'flag', 'block', 'alert'
  trigger_count integer NOT NULL DEFAULT 0,
  last_triggered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: admin only
ALTER TABLE aml_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage aml_rules" ON aml_rules FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
```

Seed 4 default AML rules.

### Dashboard Integration
- Add `{ id: "risk_control", label: "Risk Control", icon: ShieldAlert }` to the **System** group in `NAV_GROUPS`
- Add rendering block: `{activeTab === "risk_control" && <AdminRiskControl />}`
- Import the new component

### Files Changed
| File | Action |
|------|--------|
| `src/components/admin/AdminRiskControl.tsx` | **Create** — New module with 5 tabs |
| `src/pages/AdminDashboard.tsx` | **Edit** — Add nav item + import + render block |
| DB migration | **Create** — `aml_rules` table + seed data |

