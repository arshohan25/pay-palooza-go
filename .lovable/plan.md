
## Fix Clickable Metric Cards + Polish Aesthetics

User reports clicks aren't working and wants a more aesthetic feel. Let me investigate before planning.

### Likely root cause
Looking at `AdminUserMetrics.tsx`, the click handler is on `<Card>` via `onClick`. The Card from `ui/card.tsx` is a plain div forwarding props, so onClick should work — but the issue is likely that in `AdminDashboard.tsx`, the `handleMetricCardClick` either:
1. Isn't wired (prop not passed), OR
2. The Users tab filter UI doesn't render visibly so clicks feel like nothing happened, OR
3. Cross-tab navigation (`tab:xxx`) doesn't actually switch the active admin tab.

I need to verify by reading `AdminDashboard.tsx` (the relevant Users-tab section + tab-switching mechanism) before finalizing — but the plan is the same regardless.

### Plan

**1. Fix wiring in `AdminDashboard.tsx`**
- Confirm `<AdminUserMetrics onCardClick={handleMetricCardClick} />` is actually passed.
- For `tab:xxx` keys → call the existing tab switcher (setActiveTab / setSearchParams hash) so the tab actually changes.
- For user-filter keys → set `metricFilter` state AND scroll the user table into view smoothly so the user sees the result.
- Auto-clear `metricFilter` when switching away from Users tab.

**2. Make the active filter chip prominent**
- Sticky emerald gradient chip directly above the user table: `Filter: <Label> · <count> users` + Clear (X) button.
- Subtle pulse animation on first appearance so the user notices the filter took effect.

**3. Aesthetic polish on `AdminUserMetrics.tsx`**
- Replace flat `bg-color` top-bar with a soft gradient strip + matching radial glow behind icon.
- Icon tile: gradient background (`from-{color}/20 to-{color}/5`) instead of opaque `bg-opacity-10` on white icon (which currently looks washed out — the icon is `text-white` on a 10%-opacity background = nearly invisible).
- Card: `rounded-2xl`, soft border `border-border/40`, glass backdrop `bg-card/60 backdrop-blur-xl`, hover lifts with `shadow-primary/20` glow + ring in the metric's accent color.
- Section headers: small accent dot + uppercase tracking, divider line.
- Add a subtle "Click to filter" hint chip on hover (top-right corner of card) so the affordance is obvious.
- Numbers: gradient text for large values, `tabular-nums`, animated count-up on first load (lightweight, CSS only).

**4. Files touched**
- `src/pages/AdminDashboard.tsx` — verify/fix `onCardClick` wiring, tab switching, filter chip rendering, scroll-into-view.
- `src/components/admin/AdminUserMetrics.tsx` — visual polish only (no logic change).

### Out of scope
No new queries, no schema changes.
