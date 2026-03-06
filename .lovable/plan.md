

## Plan: Extend Audit Log Viewer to All Actions with Category Filter

### Changes to `src/components/admin/AdminAuditLogViewer.tsx`

1. **Remove the `.in("action", [...])` filter** from the query so all audit actions are fetched by default.

2. **Add a category filter** (new `Select` dropdown) with these categories derived from known audit actions:
   - "All categories" (default)
   - "Profile Views" — actions: `view_user_profile`, `view_all_profiles`
   - "Chargebacks" — actions: `chargeback`, `chargeback_reversal`
   - "Treasury" — actions: `treasury_disburse`
   - "Referrals" — actions: `referral_milestone_pay`, `referral_milestone_reset`, `referral_reset_all`
   - "Other" — catch-all for any action not in above groups

   When a category is selected, apply the corresponding `.in("action", [...])` filter. For "Other", use `.not("action", "in", "(known actions)")`.

3. **Add `categoryFilter` state** (`string`, default `"all"`), add it to the `useEffect` dependency array alongside existing filters.

4. **Update the title** from "Audit Log — Profile Views" to just "Audit Log".

5. **Generalize the Action column badge** — use a mapping of action string to human-readable label and icon, with a fallback that formats unknown actions as title-case.

6. **Generalize the Target column** — show `entity_type: entity_id` for non-profile-view actions, keeping the existing name/phone display for profile views.

7. **Generalize the Details column** — render `JSON.stringify(details)` truncated, instead of only handling profile-view-specific fields.

### Files modified
- `src/components/admin/AdminAuditLogViewer.tsx` (updated)

