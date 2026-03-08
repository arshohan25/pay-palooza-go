

## Plan: Keep More Menu Expanded Until Explicitly Closed

### Problem
The expanded "More Services" section collapses whenever a service item is tapped (line 555 in `QuickActions.tsx`). The user wants it to stay open until they explicitly click the "More" button again or refresh the app.

### Changes

**File: `src/components/QuickActions.tsx`**

1. **Remove auto-collapse on service tap** (line 555): Remove `setExpanded(false)` from the `onClick` handler of more service items. Instead, just call the action directly without collapsing.

2. **Keep the close (X) button functional** (line 536): This already calls `setExpanded(false)` — keep it as-is so users can still collapse via the X button.

3. **Keep the "More" button toggle** (line 418): Already toggles — keep as-is.

### Result
- Tapping a more service item triggers its action but the section stays expanded
- The section only collapses when: clicking "More" button again, clicking the X button, or refreshing

