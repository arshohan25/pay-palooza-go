

## Redesign Products/Orders Tab Navigation

### What Changes
When the user clicks **Products** or **Orders**, instead of a full-screen overlay with a back-arrow header, the content will slide up from the bottom with a fade animation, and the **tab strip** (Overview | Products | Orders) will move to the top as a sticky header — so the user can switch tabs without going "back."

### Technical Changes in `src/pages/MerchantDashboard.tsx`

1. **Separate Products/Orders from other overlay tabs**: Products and Orders will no longer use the generic full-screen overlay (lines 446-480). Instead, they get their own `AnimatePresence` block with a bottom-to-top fade-slide animation.

2. **Tab strip as header in Products/Orders view**: When `activeTab` is `"products"` or `"orders"`, render a fixed overlay that has:
   - The tab strip at the top (same 3 tabs: Overview, Products, Orders) as a sticky header with a subtle border-bottom
   - The selected tab's content below, animated with `initial={{ opacity: 0, y: 40 }}` → `animate={{ opacity: 1, y: 0 }}`

3. **Keep existing behavior for other tabs** (transactions, settlements, analytics, etc.) — they continue using the current full-screen overlay with back arrow.

4. **Animation**: Use `motion.div` with:
   - Overlay container: fade in from bottom (`y: "100%"` → `y: 0`) 
   - Content inside: subtle fade-up (`opacity: 0, y: 20` → `opacity: 1, y: 0`)

### Layout Structure (Products/Orders active)
```text
┌─────────────────────────┐
│ [Overview] [Products*] [Orders] │  ← tab strip as header
├─────────────────────────┤
│                         │
│   Products/Orders       │  ← scrollable content with fade-up
│   content here          │
│                         │
└─────────────────────────┘
```

### File Modified
- `src/pages/MerchantDashboard.tsx`

