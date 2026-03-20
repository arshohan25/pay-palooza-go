

## Per-Cause Fund Tracking for Donations

### What changes

Currently, all donation funds go into a single `platform_treasury` bucket. This plan adds a dedicated `donation_cause_funds` table so each cause tracks its own collected balance, total raised, and donor count — giving admins clear visibility into per-cause allocations.

### Database changes

**New table: `donation_cause_funds`**
- `id` (uuid, PK)
- `cause_name` (text, unique, not null) — e.g. "Education", "Healthcare"
- `cause_icon` (text, nullable)
- `balance` (numeric, default 0) — current unallocated funds for this cause
- `total_raised` (numeric, default 0) — lifetime total
- `donor_count` (integer, default 0) — unique donors (or total donation count)
- `created_at`, `updated_at` (timestamptz)
- RLS enabled; admins can read/write, authenticated users can read

**Update `process_donation` RPC:**
- After crediting `platform_treasury`, also upsert into `donation_cause_funds`: increment `balance`, `total_raised`, and `donor_count` for the matching `cause_name`. Create the row if it doesn't exist yet (INSERT ON CONFLICT).

**Update `process-recurring-donations` edge function:**
- Same pattern: after crediting treasury, upsert the cause fund row.

### Frontend changes

**DonationsPage.tsx — Cause selection screen:**
- Fetch `donation_cause_funds` and display each cause's `total_raised` as a small "৳X raised" subtitle under each cause card, giving users social proof.

**Admin: New `AdminDonationFunds` section (or add tab to existing admin):**
- Table showing each cause's balance, total raised, donor count.
- Optional: "Disburse" action to move funds from a cause balance to an external entity (future enhancement, not in v1).

### Files to create/modify
1. **New migration** — create `donation_cause_funds` table + update `process_donation` RPC
2. **`supabase/functions/process-recurring-donations/index.ts`** — add cause fund upsert after treasury credit
3. **`src/pages/DonationsPage.tsx`** — fetch and display per-cause totals on cause cards
4. **`src/pages/AdminDashboard.tsx`** — add donation funds visibility (small addition)

### Technical details
- The `donation_cause_funds` upsert uses `INSERT ... ON CONFLICT (cause_name) DO UPDATE` to atomically increment balances within the same transaction as the donation.
- Treasury still receives the funds (dual tracking), so existing treasury reporting is unaffected.
- RLS: `SELECT` for authenticated, `ALL` for admins via `has_role()`.

