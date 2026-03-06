

## Plan: Fix Chat Menu, Bottom Spacing & New Message Animation

### 1. Fix "Block/Report User" dropdown positioning (Lines 935, 961)
The dropdown menu is inside a flex container without `relative` positioning, causing it to overlap message content instead of appearing neatly below the header button.

**Fix**: Add `relative` to the action buttons container (line 935) so the `absolute` positioned dropdown anchors correctly to the button area.

Change line 935: `<div className="flex items-center gap-1">` → `<div className="flex items-center gap-1 relative">`

### 2. Reduce bottom padding by 10px (Line 1130)
Change compose box bottom padding from `pb-[max(20px,env(safe-area-inset-bottom,20px))]` to `pb-[max(10px,env(safe-area-inset-bottom,10px))]`.

### 3. Add subtle new message animation (Lines 995-998)
The current animation already exists (`initial={{ opacity: 0, y: 8, scale: 0.95 }}`), but it fires on mount for ALL messages at once. Improve it:

- Keep the spring animation but add a staggered delay based on index for initial load: `transition={{ delay: idx * 0.03 }}`
- For newly arriving messages (appended in realtime), the existing animation will naturally apply since only the new message mounts

### Files modified
- `src/pages/InboxPage.tsx`

