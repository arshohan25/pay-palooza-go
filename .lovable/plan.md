

## Make Transaction Safety Rules Editable

### Problem
The 5 Transaction Safety Rules in the "Txn Rules" tab are hardcoded with static badges. Admins cannot toggle them on/off or edit their parameters.

### Solution
Replace the static array with interactive controls:

1. **Store rules in state** — initialize from the hardcoded defaults, allowing each rule's `enabled` status to be toggled via a `Switch` component (replacing the static `Badge`).

2. **Add inline editing** — clicking a rule row (or an edit icon) expands an inline edit area where the admin can modify the description/parameter (e.g., change "30 seconds" to "60 seconds", or "20 transactions" to "50").

3. **Persist to database** — create a `transaction_safety_rules` table to store these rules so changes survive sessions. On load, fetch from DB; fall back to defaults if empty.

4. **Save with toast feedback** — toggling or editing a rule saves immediately to the database with a success toast.

### Database Migration
```sql
CREATE TABLE public.transaction_safety_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key text UNIQUE NOT NULL,
  label text NOT NULL,
  description text NOT NULL,
  is_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.transaction_safety_rules ENABLE ROW LEVEL SECURITY;

-- Seed defaults
INSERT INTO public.transaction_safety_rules (rule_key, label, description, is_enabled) VALUES
  ('duplicate_guard', 'Duplicate Transaction Guard', 'Block identical txns within 30 seconds', true),
  ('velocity_control', 'Velocity Control', 'Max 20 transactions per hour per user', true),
  ('night_restriction', 'Night-time Restriction', 'High-value txns blocked 12AM-6AM', false),
  ('new_account_limit', 'New Account Limit', 'Reduced limits for accounts < 7 days old', true),
  ('cross_device_alert', 'Cross-device Alert', 'Alert on txn from new device', true);
```

### UI Changes in `AdminSystemSettings.tsx` — `TransactionRulesTab`
- Fetch rules from `transaction_safety_rules` on mount
- Each rule row: `Switch` to toggle `is_enabled`, pencil icon to enter inline edit mode for description
- Inline edit shows an `Input` + Save/Cancel buttons
- Toggle and save both update the DB immediately

### Files Modified
1. `src/components/admin/AdminSystemSettings.tsx` — refactor `TransactionRulesTab` to use DB-backed editable rules
2. Database migration — create `transaction_safety_rules` table with seed data and RLS

