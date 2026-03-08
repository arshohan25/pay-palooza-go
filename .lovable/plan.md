

## Plan: Long-Press Tooltip for Quick Action Icons

Add a long-press/hold interaction (500ms) on both the main grid and "More Services" grid icons that shows an animated tooltip bubble with a brief description of each service.

### 1. Add descriptions to `actionDefs` (line 48-57)

Add a `desc` field to each action definition:
- send: "Send money to anyone instantly"
- cashout: "Withdraw cash from your wallet"
- payment: "Pay merchants & stores"
- bank: "Transfer to bank accounts"
- recharge: "Top up mobile balance"
- bill: "Pay utility & other bills"
- shop: "Browse & buy from shops"
- more: "Explore more services"

### 2. Add long-press state and handlers

Add state: `longPressId: string | null` and a `longPressTimer` ref.

Create handlers:
- `onPointerDown(id)` — starts a 500ms timer, on expiry sets `longPressId` to show tooltip
- `onPointerUp/onPointerLeave` — clears timer and hides tooltip
- When `longPressId` is set, prevent the `onClick` from firing (use a `didLongPress` ref flag)

### 3. Render tooltip bubble on main grid icons (lines ~170-210)

When `longPressId === action.id`, render a `motion.div` tooltip positioned above the icon with `AnimatePresence` for smooth enter/exit. Shows the `desc` text in a small styled bubble with a caret pointing down.

### 4. Render tooltip bubble on "More Services" icons (lines ~250-300)

Same long-press logic applied to the expanded grid items, using `item.desc` which already exists on `moreServices`.

### 5. Prevent click on long-press

Use a ref flag `didLongPress` — set it `true` when tooltip shows, check it in `onClick`/`handleAction` to skip the action, reset on pointer up.

### Single file change: `src/components/QuickActions.tsx`, ~40 lines added.

