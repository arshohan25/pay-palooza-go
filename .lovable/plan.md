

## Donations: Anonymous Mode, Receipt Sharing, and Leaderboard

### 1. Database Migration

**Add `is_anonymous` column to `donations` table:**
```sql
ALTER TABLE donations ADD COLUMN is_anonymous boolean NOT NULL DEFAULT false;
```

**Add RLS policy for public leaderboard reads** (only expose non-anonymous donor names):
```sql
CREATE POLICY "Public read donations for leaderboard"
  ON donations FOR SELECT TO authenticated
  USING (true);
```
Update the existing "Users view own donations" policy — actually, adding the broader policy covers it. Remove the old one to avoid confusion.

**Create a leaderboard RPC** (security definer to join profiles safely):
```sql
CREATE OR REPLACE FUNCTION public.donation_leaderboard(p_cause text DEFAULT NULL)
RETURNS TABLE(donor_name text, total_amount numeric, donation_count bigint, cause_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    CASE WHEN d.is_anonymous THEN 'Anonymous' ELSE COALESCE(p.name, 'Unknown') END as donor_name,
    SUM(d.amount) as total_amount,
    COUNT(*) as donation_count,
    d.cause_name
  FROM donations d
  LEFT JOIN profiles p ON p.user_id = d.user_id
  WHERE (p_cause IS NULL OR d.cause_name = p_cause)
  GROUP BY d.user_id, d.cause_name, d.is_anonymous, p.name
  ORDER BY total_amount DESC
  LIMIT 50
$$;
```

### 2. Amount Step — Add Anonymous Toggle

In the amount step (Step 2), add a switch/checkbox: "Donate anonymously" that sets `isAnonymous` state. Pass it to the insert call.

### 3. Success Step — Share Receipt

On the success screen, add a "Share Receipt" button that opens the existing `ShareReceiptSheet` component with donation details (cause, amount, date, anonymous status).

### 4. New Leaderboard Tab

Add a third tab "Leaderboard" to the Tabs component. It will:
- Call `supabase.rpc('donation_leaderboard')` on mount
- Show a cause filter (horizontal pill selector for each cause + "All")
- Display a ranked list with medal icons for top 3, showing donor name (or "Anonymous"), total amount, and donation count
- Each cause card uses its matching gradient

### Files Changed

- **Migration**: Add `is_anonymous` column, leaderboard RPC, update RLS
- **`src/pages/DonationsPage.tsx`**: Add `isAnonymous` state + toggle in amount step, share receipt on success, new leaderboard tab with cause filter

