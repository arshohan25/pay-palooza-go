

## Convert Global Toggles to Horizontal Tab Menu

### Change
Replace the vertical collapsible accordion layout with a **horizontal scrollable tab bar** where each section (Wallet, Services, Merchant, Agent, etc.) is a tab. Clicking a tab shows only that section's toggles below.

### Implementation — Single file change

**File**: `src/components/admin/AdminGlobalToggles.tsx`

1. Remove `Collapsible` imports and `openSections` state
2. Add `activeSection` state (defaults to first visible section)
3. Replace the accordion render with:
   - A horizontally scrollable tab bar (`overflow-x-auto flex gap-2`) with pill-style buttons for each visible section (icon + label + count badge)
   - Active tab highlighted with primary color
   - Below the tabs, render `renderToggleList()` for only the active section's toggles
4. Keep all existing CRUD, bulk actions, dialogs unchanged

