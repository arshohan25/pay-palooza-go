

## Plan: Make Live Chat Responsive

### Problem
The Live Chat admin panel has layout issues at various breakpoints: long messages overflow, chat header action buttons crowd on tablets, and the two-panel layout feels cramped on medium screens. The screenshot shows encrypted text overflowing the message bubble.

### Changes

**`src/components/admin/AdminSupportDashboard.tsx`**

1. **Fix message overflow** - Add `overflow-hidden word-break: break-all` to message bubbles so long strings (like encrypted text or base64) wrap properly instead of overflowing horizontally.

2. **Responsive chat header actions** - Stack action buttons vertically or use icon-only buttons on smaller screens (below `lg`). Hide button text on tablets, show only icons with tooltips.

3. **Responsive conversation list width** - Change sidebar from `md:w-80 lg:w-96` to `md:w-72 lg:w-80 xl:w-96` for better fit on medium screens.

4. **Responsive user info in chat header** - Truncate long email/phone on smaller screens, hide email below `lg`.

5. **Message bubble max-width** - Increase from `max-w-[70%]` to `max-w-[85%]` on mobile, keep `70%` on larger screens using responsive classes.

6. **Quick Replies popover** - Make popover width responsive: `w-64 md:w-80`.

7. **Conversation list items** - Ensure email and assigned agent badges wrap properly on narrow sidebars. Hide email in sidebar below `lg`.

### Technical Detail
- All changes are CSS/Tailwind only within `AdminSupportDashboard.tsx`
- Key fix: `break-all` or `overflow-wrap: anywhere` on message content `<p>` to handle base64/encrypted strings
- Use responsive utility classes (`md:`, `lg:`, `xl:`) for progressive layout enhancement

