# ETA confidence indicator on Step 3

Add a color-coded confidence indicator to the "Get approved" step's ETA chip in `VendorOnboardingChecklist.tsx`, driven by `sample_size` returned by the existing `get_merchant_review_eta` RPC.

## Confidence tiers

| Tier | Sample size | Color | Label |
|---|---|---|---|
| Estimate | `is_estimate=true` or `< 3` | Muted gray | "Estimated" |
| Low | 3–9 | Rose / red | "Low confidence" |
| Medium | 10–29 | Amber | "Medium confidence" |
| High | ≥ 30 | Emerald | "High confidence" |

Boundaries are easy to tweak later in one place.

## Visual design (Step 3 only)

The existing ETA pill (`~4h typical` / `1–2 days est.`) gets:

1. A small **2px solid dot** on the left of the chip text, colored per tier (rose / amber / emerald / muted).
2. The pill's **background, text, and border** colors switch to match the tier (instead of the current generic muted style). Keeps glassmorphism feel — uses `/10` bg, `/30` border, `-700` text in the project's existing semantic Tailwind palette.
3. The existing tooltip (`title=`) is replaced with a tier-specific message:
   - Estimate: "Estimated — not enough recent approvals to compute a real ETA yet."
   - Low/Medium/High: "{Tier} confidence — based on {n} recent approvals."
4. A tiny one-line caption directly under the step (replaces the current `Based on last N approvals` line):
   `<dot> Low confidence • 4 approvals` etc. Hidden when status is `done` or `locked`.

Animation: dot uses a soft `animate-pulse` only for the **Estimate** tier so users notice the data is provisional. Other tiers are static.

Behavior is fully reactive — `eta` already updates via the 5-min poll + `merchants` postgres_changes subscription, so confidence flips tiers in real time as new approvals come in.

## Implementation

Single file: `src/components/VendorOnboardingChecklist.tsx`

1. After the `etaChipText` memo, add a `confidence` object derived from `eta` with `{ tier, label, dotClass, chipClass, tip }`.
2. In the step render loop, when `idx === 2`, replace the chip's static class string and `title` with `confidence.chipClass` and `confidence.tip`. Prepend a `<span class="w-1.5 h-1.5 rounded-full {confidence.dotClass}" />` inside the chip.
3. Replace the existing `Based on last {sample} approvals` line with the new caption that uses `confidence.label` + sample count, shown for all non-done/locked states (including `in_review`).

No new dependencies, no DB changes, no RPC changes.

## Files
- `src/components/VendorOnboardingChecklist.tsx` (edit only)
