

## Make All Admin Panel Elements Actionable

After auditing every admin module, here are the specific non-functional elements found and fixes needed:

### Issues Found

**1. AdminRiskControl.tsx — Agent Fraud tab**
- "View" and "Freeze" buttons (lines 92-95) have **no onClick handlers** — they render but do nothing
- Fix: View opens a Sheet with agent details; Freeze calls `toggleAgentStatus` and logs to audit

**2. AdminRiskControl.tsx — Risk Dashboard tab**
- 7-day trend chart uses `Math.random()` (line 371) — **fake data**
- Fix: Query `fraud_alerts` grouped by day for real trend data

**3. AdminAiFraudDetection.tsx — Risk Profiles & Velocity tabs**
- Profile rows and velocity violation rows show data but have **no action buttons**
- Fix: Add "Investigate" (creates fraud_alert), "Lock" (freezes wallet), and "View" (navigates to user detail) buttons

**4. AdminGeoTracking.tsx — Transaction Hotspots**
- Hotspot volume uses `Math.random() * 50 + 20` (line 53) — **fake data**
- Fix: Query actual `transactions` and cross-reference with agent territories for real counts

**5. AdminSmartRouting.tsx — Routing Rules**
- Three Switch toggles (Failover, Amount-based, Load Balancing) at lines 171-188 are **not persisted** — reset on refresh
- Fix: Store routing rules in `global_feature_toggles` or localStorage with proper save/load

**6. AdminSmartRouting.tsx — Payment Links**
- Created links stored in **client state only** (line 40) — lost on page refresh
- Fix: Persist to a new `payment_links` table in the database

### Database Changes

One new table for payment link persistence:

```sql
CREATE TABLE public.payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  amount numeric,
  currency text NOT NULL DEFAULT 'BDT',
  description text,
  short_code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage payment_links" ON public.payment_links
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
```

### Files Changed

| File | Changes |
|------|---------|
| `src/components/admin/AdminRiskControl.tsx` | Wire View/Freeze buttons with Sheet + agent status toggle; replace random trend with real fraud_alerts query |
| `src/components/admin/AdminAiFraudDetection.tsx` | Add Investigate/Lock/View action buttons to Risk Profiles and Velocity tabs |
| `src/components/admin/AdminGeoTracking.tsx` | Replace Math.random hotspot data with real transaction counts |
| `src/components/admin/AdminSmartRouting.tsx` | Persist routing rules to global_feature_toggles; persist payment links to new DB table |
| DB migration | Create `payment_links` table |

