

## Plan: Animated Empty States for Transaction History & Inbox

### 1. TransactionHistory.tsx (lines 370-387)
Update the existing empty state to match the animated pattern used in other flows:
- Change the icon container from static `div` to `motion.div` with the floating animation (`animate={{ y: [0, -4, 0] }}`, `duration: 2`, `repeat: Infinity`)
- Update the outer `motion.div` to use `scale: 0.9` initial state matching the other flows (`initial={{ opacity: 0, scale: 0.9, y: 12 }}`)
- Change icon container shape from `rounded-3xl` to `rounded-full` for consistency with the other empty states

### 2. InboxPage.tsx (lines 1654-1678)
Update the existing empty state similarly:
- Add `scale: 0.9` to the outer `motion.div` initial state
- Wrap the icon container (`w-20 h-20 rounded-full`) in `motion.div` with the same floating animation
- Keep all existing conditional text and the "Start Chatting" button as-is

### Files Modified
- `src/pages/TransactionHistory.tsx`
- `src/pages/InboxPage.tsx`

