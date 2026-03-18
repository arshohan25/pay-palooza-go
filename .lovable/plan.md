

## Donations Feature

### How It Works

Users tap "Donations" from the More menu → navigate to `/donations` page → browse preset causes (e.g., Education, Disaster Relief, Healthcare, Clean Water) → select a cause → choose a preset amount (৳50, ৳100, ৳500, ৳1000) or enter a custom amount → confirm with PIN → donation is deducted from wallet balance via the existing `record_transaction` RPC (type: `payment`, description includes cause name) → success animation → donation saved to a `donations` table for history tracking.

A "Donation History" tab on the same page shows past donations with cause, amount, date.

---

### 1. Database — New Table

**`donations`** — tracks all donation records

```sql
CREATE TABLE public.donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cause_name text NOT NULL,
  cause_icon text,
  amount numeric NOT NULL,
  transaction_id uuid REFERENCES transactions(id),
  message text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
-- Users see own donations
CREATE POLICY "Users view own donations" ON public.donations FOR SELECT TO authenticated USING (user_id = auth.uid());
-- Users insert own donations
CREATE POLICY "Users insert own donations" ON public.donations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
-- Admins full access
CREATE POLICY "Admins manage donations" ON public.donations FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
```

### 2. New Page: `src/pages/DonationsPage.tsx`

- **Causes Grid**: 6 preset causes with icons and gradients (Education, Disaster Relief, Healthcare, Clean Water, Food Security, Orphan Support)
- **Amount Selection**: Preset chips (৳50, ৳100, ৳500, ৳1000) + custom input
- **Optional message** field
- **PIN confirmation** via existing `verifyPin` utility
- **Wallet deduction** via `record_transaction` RPC (type `payment`, description: "Donation: {cause}")
- **Insert into `donations`** table after successful transaction
- **History Tab**: Lists past donations with cause icon, name, amount, and date

### 3. Modifications

| File | Change |
|------|--------|
| `src/components/MoreSheet.tsx` | Remove `soon: true` from donations item, add navigation to `/donations` |
| `src/App.tsx` | Add `/donations` route |
| `src/pages/DonationsPage.tsx` | New page (causes grid, amount picker, PIN confirm, history tab) |
| Migration | Create `donations` table with RLS |

### 4. Flow Summary

```text
More Menu → Donations → Select Cause → Pick/Enter Amount
→ (optional message) → Confirm PIN → Wallet Deducted
→ Donation recorded → Success toast → View in History tab
```

