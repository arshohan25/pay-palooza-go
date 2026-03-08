

## Add Drag-and-Drop Toggle in Settings

### What Changes
Drag-and-drop reordering of Quick Actions will be **disabled by default**. Users must enable it via a new toggle in the Account/Settings page under "App Experience". The preference is persisted in `localStorage`.

### Changes

**1. `src/pages/AccountPage.tsx`**
- Add a new `ToggleRow` in the "App Experience" section (after the Language row):
  - Icon: `GripVertical` (from lucide-react)
  - Label: "Rearrange Quick Actions"
  - Sub: "Enable drag & drop to customize icon order"
  - State stored in `localStorage` key `mfs_dnd_enabled`, default `false`
  - On toggle, show toast confirmation

**2. `src/components/QuickActions.tsx`**
- Read `localStorage.getItem("mfs_dnd_enabled") === "true"` to determine if DnD is active
- When DnD is disabled:
  - Set all items as `isDraggable={false}` (no grip handles, no drag sensors)
  - Hide the "Reset order" button
- When DnD is enabled: current behavior (fixed first 3, rest sortable)

This is a simple localStorage-based toggle — no database changes needed.

