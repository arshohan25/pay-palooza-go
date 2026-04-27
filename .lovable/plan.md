# API Onboarding Checklist

Add a compact, real-time checklist at the top of the merchant **API** tab so merchants can see exactly where they are in the integration journey. Each step lights up automatically as they complete it — no manual ticking.

## What the merchant sees

A premium card titled **"API Onboarding"** placed above the existing *API Access* section, showing:

- A progress ring / bar (e.g. *3 of 6 complete*) with percentage.
- A vertical list of steps, each with:
  - State icon (✓ done / ● in-progress / ○ todo / ⚠ attention).
  - Title + one-line helper text.
  - A small inline action button that scrolls/jumps to the relevant section (e.g. *"Request access"*, *"Create key"*, *"Add webhook"*).
- A celebratory state when all steps are complete ("You're live — start accepting payments").
- Collapsible: once 100% complete the card auto-collapses to a single "Integration complete" pill that can be re-expanded.

## Steps & completion logic

All derived from data already loaded in `MerchantApiTab.tsx` — no new queries.

| # | Step | Done when |
|---|------|-----------|
| 1 | Request API access | `requests.length > 0` |
| 2 | Access approved | `hasApprovedAccess === true` |
| 3 | Create your first API key | `keys.length > 0` |
| 4 | Reveal & copy credentials | at least one key id is in `revealedFields` **or** persisted flag `ezp_api_onboarding_copied_<merchantId>` in `localStorage` (set on first copy of `api_key`/`secret_key`) |
| 5 | Register a webhook URL | any `k.webhook_url` is non-empty |
| 6 | Successful test transaction | any session in `sessions` has `status === "completed"` and (`webhook_delivered === true` or `metadata.webhook_status === "delivered"`) |

Special states:
- Step 2 shows ⚠ amber "Pending review" when there is a request but `!hasApprovedAccess`.
- Step 5 shows ⚠ when a webhook URL exists but the latest delivery for that key is `failed` (uses the same logic already computed for the webhook card).
- Steps after an unmet prerequisite render disabled (muted, no action button).

## Inline actions

Each step's action scrolls to and focuses the relevant block via existing DOM (use `id` anchors added to the existing sections):
- Step 1 → opens the existing *Request API Access* form (`setShowRequestForm(true)`).
- Step 3 → triggers `createKey()` (respecting the existing 5-key cap & disabled state).
- Step 4 → scrolls to the credentials card and toggles reveal on the newest active key.
- Step 5 → scrolls to the webhook card and focuses the URL input for the newest active key.
- Step 6 → opens a small popover linking to the Developer Portal "Send test payment" guide and exposes the existing *Send test event* button.

## Technical details

- **File:** `src/components/MerchantApiTab.tsx` only. No DB migration, no edge function, no new dependency.
- **New component (inline in same file):** `OnboardingChecklist` — a pure function component that takes the already-computed values (`requests`, `hasApprovedAccess`, `keys`, `sessions`, `revealedFields`, helpers) and renders the card.
- **Persistent "copied" flag:** wrap the existing `copyText` calls for `api_key` / `secret_key` to also set `localStorage.setItem('ezp_api_onboarding_copied_' + merchantId, '1')`. Read on mount into a `hasCopiedCreds` state.
- **Anchors / refs:** add `useRef`s for `requestSectionRef`, `credentialsSectionRef`, `webhookSectionRef` and call `scrollIntoView({ behavior: 'smooth', block: 'start' })` from the step actions.
- **Auto-collapse:** local state `checklistExpanded`, defaults to `true`; flips to `false` once `completedCount === total` and the user hasn't manually toggled it (tracked via a `userTouchedChecklist` ref).
- **Styling:** matches the existing premium glass aesthetic — `Card` with subtle border, emerald for done, primary for in-progress, muted for todo, amber for warnings. Uses `lucide-react` icons already imported (`CheckCircle2`, `Circle`, `AlertCircle`, `ChevronDown`, `Sparkles`) — add any missing to the existing import line.
- **No flicker:** computed via `useMemo` from the same data that drives the rest of the tab, so it stays in sync with the existing realtime refresh loop.

## Out of scope

- No new database columns or tracking table — completion is derived, which keeps it accurate even after key rotation/revocation.
- No changes to admin-side API hub.
- No analytics events (can be added later if needed).
