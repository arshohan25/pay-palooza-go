# Merchant Approval Template Preview (Admin)

Add an admin-only preview tab that renders the **email** and **push notification** outputs of `notify-merchant-approval` with a sample merchant name, so reviewers can verify copy and CTAs before any real send.

## What the user will see

A new **"Approval Templates"** sub-section inside the existing Merchant Applications admin area, containing:

1. **Controls bar** (glass card)
   - Merchant name input (default: "Karim Electronics")
   - Reviewer name input (default: "Karim Rahman")
   - Status toggle: Approved / Rejected
   - Reason textarea (only enabled when Rejected)
   - "Use random sample" button (cycles through 5 realistic Bangladeshi business names)

2. **Push notification preview** (left column)
   - Mock phone-style card matching our PWA push look (icon, title, body, "merchant_ops" category chip, "Open Merchant Dashboard →" CTA)
   - Updates live as inputs change

3. **Email preview** (right column)
   - Iframe rendering the exact HTML the edge function generates
   - Header with subject line shown above the iframe
   - "Open in new tab" button + "Copy HTML" button

No emails or pushes are actually sent — this is a pure render preview.

## Technical implementation

**Shared template module** — extract the title/body/subject/HTML builders from `supabase/functions/notify-merchant-approval/index.ts` into a new client-safe helper `src/lib/merchantApprovalTemplate.ts` exporting:
- `buildPushPayload({ businessName, status, reason })` → `{ title, body, ctaLabel, ctaUrl }`
- `buildEmailPayload({ businessName, recipientName, status, reason })` → `{ subject, html }`

Then refactor the edge function to import the same logic via inline duplication (keep the exact same strings — edge functions can't import from `src/`, so we copy the pure functions into the EF and add a comment marking them as the source of truth mirror).

**New component** `src/components/admin/AdminApprovalTemplatePreview.tsx`
- React state for `businessName`, `recipientName`, `status`, `reason`
- Memoised `pushPayload` and `emailPayload` from the shared helper
- Push card built with Tailwind + design tokens (glass, 19px radii)
- Email rendered into an `<iframe srcDoc={html} />` sized 560×640 with white background

**Wiring** — add a tab inside `AdminMerchantApplications.tsx` (segmented control: "Applications" | "Templates") so it lives next to the live approval queue. No new route needed; uses the existing admin tab guard.

## Files to create / edit

- `src/lib/merchantApprovalTemplate.ts` (new) — shared title/body/subject/HTML builders
- `src/components/admin/AdminApprovalTemplatePreview.tsx` (new) — preview UI
- `src/components/admin/AdminMerchantApplications.tsx` (edit) — add segmented control + render preview
- `supabase/functions/notify-merchant-approval/index.ts` (edit) — replace inline builders with mirrored pure functions matching `merchantApprovalTemplate.ts` exactly (same strings, same CTAs)

## Out of scope

- No DB changes, no new RLS policies, no new edge function
- No actual sending from the preview (admin can still trigger real approval from the live queue tab)
