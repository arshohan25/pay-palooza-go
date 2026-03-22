

## Polish Global Toggles Tab Bar

### Changes — Single file: `AdminGlobalToggles.tsx`

1. **Unified background**: Wrap all tab buttons in a single rounded container with `bg-muted/50 rounded-xl p-1` so they sit on one shared background strip (like a segmented control)
2. **Remove "off" badges**: Delete the red `{offCount} off` destructive badges from each tab and from the header
3. **Smooth tab-switch animation**: Use `framer-motion` `AnimatePresence` + `motion.div` with fade+slide for the toggle list content area when switching sections. Add `layoutId` on the active tab indicator for a sliding highlight effect

### Visual result
- Tabs appear as pills inside one cohesive bar (shared background)
- No red "off" markers cluttering the tabs
- Switching tabs animates content smoothly (fade + subtle vertical slide)

