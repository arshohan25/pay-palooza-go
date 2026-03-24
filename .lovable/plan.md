

## Plan: Unify Admin Dashboard Menu/Card Styles

### Context
The admin dashboard has inconsistent styling across components. The Session Timeout Management card (App Config tab) uses the cleanest pattern: a Card with header icon + title + subtitle, followed by structured rows with icon + label + control. This style needs to be applied consistently to the Activity Monitor and other admin sections.

### Style Pattern to Standardize

```text
┌─ Card (border-0 shadow-card) ──────────────────────┐
│  [Icon] Section Title                               │
│  Subtitle description text                          │
│                                                     │
│  ┌─ Row ──────────────────────────────────────────┐ │
│  │ [Icon] Label               [Control/Badge]     │ │
│  └────────────────────────────────────────────────┘ │
│  ┌─ Row ──────────────────────────────────────────┐ │
│  │ [Icon] Label               [Control/Badge]     │ │
│  └────────────────────────────────────────────────┘ │
│                                                     │
│  Filter bar: pill-style buttons, not outline        │
└─────────────────────────────────────────────────────┘
```

### Changes

**1. AdminActivityMonitor.tsx** - Major redesign
- Replace `CardHeader`/`CardTitle` with the standard card header pattern (icon + title + subtitle in `CardContent`)
- Redesign filter bar: type and status filters as compact pill-style badges in a `flex-wrap` layout (matching Global Toggles segmented control style) instead of outline `Button` rows
- Unify the search bar + actions row with the same spacing/sizing used in other admin cards
- Keep the table/mobile card layout but update header row to use consistent `text-xs font-medium text-muted-foreground` styling

**2. AdminSystemSettings.tsx** - Minor tweaks
- Ensure all tab content cards use the same header pattern: `[Icon] Title` as `text-sm font-medium` with optional subtitle
- Standardize "Platform Information", "Quick Feature Toggle Summary", "Currency Configuration", "Transaction Safety Rules", "System Health", "Scheduled Jobs" cards to all use the same card header format
- Make the editable config rows consistent with the Session Timeout rows (icon + label + control alignment)

**3. AdminReporting.tsx** - Header consistency
- Wrap stat cards in a consistent grid pattern matching the `grid-cols-3 gap-2` pattern from AppConfigTab
- Standardize chart card headers to match `[Icon] Title` format

**4. AdminAgentHub.tsx** - Filter/stat consistency  
- Stat cards at the top should use the same `border-0 shadow-card` Card pattern with `text-[10px]` labels
- Search/filter bar should match the Activity Monitor redesign

### Files Modified
- `src/components/admin/AdminActivityMonitor.tsx` — redesign header, filter bars, and table styling
- `src/components/admin/AdminSystemSettings.tsx` — standardize card headers across all tabs
- `src/components/admin/AdminReporting.tsx` — unify stat card and chart headers
- `src/components/admin/AdminAgentHub.tsx` — match filter/stat card styles

### Scope Note
This focuses on the 4 most visible admin sections. The same patterns will naturally cascade to other admin components through consistency.

