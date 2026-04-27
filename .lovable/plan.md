# Real-time ETA on the "Get Approved" Step

Show a data-driven ETA on step 3 of the vendor onboarding checklist. Pulled from actual recent admin review durations, with a smart cold-start fallback, refreshed live as approvals happen and as the user's own pending time grows.

## Data source — `get_merchant_review_eta()` RPC

A new SECURITY DEFINER function (callable by any authenticated user) that returns a small JSON snapshot:

```json
{
  "median_minutes": 720,
  "p90_minutes": 1800,
  "sample_size": 14,
  "is_estimate": false,
  "computed_at": "2026-04-27T15:30:00Z"
}
```

Logic:
- Look at `merchants` rows in the last **60 days** where `business_kyc_status = 'approved'` AND `business_kyc_reviewed_at IS NOT NULL`.
- ETA window = `(business_kyc_reviewed_at - created_at)`.
- Return median + p90 minutes + sample size.
- **Cold-start fallback** (sample_size < 3): return `median_minutes = 1440` (24h), `p90_minutes = 2880` (48h), `is_estimate = true` — matches the current "1–2 days" copy.
- Filter out outliers > 14 days to prevent one stale row from skewing the average.

This is read-only, exposes no PII (no merchant IDs, no user IDs — just aggregate timing), and safe to grant to `authenticated`.

## Frontend in `VendorOnboardingChecklist`

1. **Fetch** the ETA via `supabase.rpc('get_merchant_review_eta')` on mount and cache in component state. Re-fetch every 5 minutes (covers slow drift).
2. **Format** the ETA for the step row's right-side chip:
   - `< 60 min` → "~Xm typical"
   - `< 24 h` → "~Xh typical"
   - `≥ 24 h` → "~Xd typical"
   - When `is_estimate=true`: show "1–2 days" (current default) with a subtle "estimated" hint.
3. **Personalized countdown** when the user's own application is pending:
   - Compute `elapsed = now() - merchant_application.created_at`.
   - If `elapsed < median`: show "About {median - elapsed} left" in amber.
   - If `elapsed < p90`: show "Almost there — usually done by now" in amber.
   - If `elapsed > p90`: show "Taking longer than usual — we'll notify you soon" in muted tone (no panic).
   - This countdown ticks every 60 seconds via a local interval.
4. **Real-time updates** — subscribe to `postgres_changes` on `merchants` (event UPDATE, no filter — global) and re-fetch the RPC when any merchant transitions to `approved`. So the ETA tightens immediately after each new approval ships.
5. **Tooltip / sub-line** on the chip: "Based on the last {sample_size} approvals" so it's transparent.

## Files

- **New migration**: `get_merchant_review_eta()` RPC (SECURITY DEFINER, returns JSON, GRANT EXECUTE TO authenticated).
- **`src/components/VendorOnboardingChecklist.tsx`**:
  - New `useReviewEta()` inline hook (RPC fetch + 5-min refresh + global merchants subscription).
  - Update step 3's `eta` and add a personalized countdown line under the title when status = `in_review`.
  - Add a small "Based on N recent approvals" caption.

## Out of scope

- Per-category or per-region ETAs (sample size too small).
- Historical ETA charts.
- Notifying the user when ETA changes (just visual update).

Approve and I'll implement.
