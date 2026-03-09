

## Fix Agent Menu Drawer — Z-index and Close Issues

### Problems Found During Testing
1. **Sheets/modals open behind the drawer** — The drawer uses `z-[70]`/`z-[71]`, but Sheet and UserQrModal render at lower z-index, so they're hidden behind the drawer.
2. **Backdrop click doesn't close the drawer** — The backdrop overlay click handler doesn't fire.
3. **X close button doesn't work** — The close button appears non-functional.

### Fix Plan

**`src/components/AgentMenuDrawer.tsx`**

1. **Close drawer before opening sheets**: When a menu item that opens a sheet/modal is clicked, call `onClose()` first (to close the drawer), then open the sheet/modal. This avoids z-index conflicts entirely.

2. **Fix close button**: Ensure the X button's `onClick={onClose}` fires correctly by adding `e.stopPropagation()` if needed.

3. **Fix backdrop close**: The backdrop `onClick={onClose}` should work — verify it's not being blocked by event propagation from the drawer panel. Add `e.stopPropagation()` on the drawer panel to prevent clicks inside from reaching the backdrop incorrectly, and ensure the backdrop div is truly behind the drawer content.

### Implementation Detail

For menu items that open sheets (Edit Avatar, Share QR, Customer KYC, Analytics):
```tsx
// Instead of just opening the sheet:
{ icon: Camera, label: "Edit Avatar", action: () => setAvatarSheetOpen(true) }

// Close drawer first, use setTimeout to let animation complete:
{ icon: Camera, label: "Edit Avatar", action: () => { onClose(); setTimeout(() => setAvatarSheetOpen(true), 300); } }
```

For the close button condition in `menuItems.map` — currently the click handler has a conditional `onClose()` call that skips closing for sheet-opening items. This should be removed since we'll handle closing inside each action.

For the backdrop — ensure the motion.div backdrop receives clicks properly.

### Files changed
| File | Change |
|------|--------|
| `AgentMenuDrawer.tsx` | Close drawer before opening sheets/modals; fix backdrop and X button close handlers |

