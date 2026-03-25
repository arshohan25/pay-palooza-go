## Plan: Move Date Filters, Search(if avilable) & Actions to Header Row (Top Right)

### Problem

Several admin components have date pickers, Export CSV buttons, and filter controls sitting in separate rows below the header, wasting vertical space. These should be consolidated into the header row (right side), matching the Activity Monitor pattern.

### Components to Update (5 files)


| #   | File                          | Current Layout                                              | Change                                                                                  |
| --- | ----------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | `AdminAdvancedReports.tsx`    | Date inputs + Export CSV in separate row below tabs         | Move date inputs + Export icon button into header row (right of title), remove subtitle |
| 2   | `AdminBankReconciliation.tsx` | Date inputs in separate row, Export button in header        | Move date inputs into header row alongside Export button, remove subtitle               |
| 3   | `AdminRevenueDashboard.tsx`   | Date inputs + Apply + CSV button in standalone row          | Move all into a header row with title on left                                           |
| 4   | `TeamActivityLog.tsx`         | Member select + date inputs + Refresh in a row              | Move date inputs + Refresh into header row, keep member Select inline                   |
| 5   | `AdminCommissionSetup.tsx`    | Type Select + Export CSV in standalone row (ledger section) | Move Export button to right of section header                                           |


### Visual Result (all components)

```text
┌──────────────────────────────────────────────────────────────┐
│ [icon] Title          [date] to [date] [⬇] [🔄]            │
│                                                              │
│ ┌─ segmented tabs ─────────────────────────────────────────┐ │
│ │ [Tab1] [Tab2] [Tab3]                                     │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### Pattern

- Header: `flex items-center justify-between flex-wrap gap-2`
- Left: icon + title
- Right: compact date inputs (`h-7 w-32 text-xs`) + icon-only Export/Refresh buttons (`h-7 w-7`)
- Remove subtitle text to keep header compact
- Date inputs shrunk to fit header row without wrapping on desktop