

## Admin Dashboard Mobile Visibility Fix

### Investigation Summary

I tested all 19 admin tabs on a 390x844 mobile viewport via browser automation. All tabs rendered their content. However, I identified several potential issues that could cause content to appear hidden or inaccessible on certain mobile devices or screen sizes:

### Issues Found

1. **Main content scroll constraint**: The `<main>` element uses `overflow-auto` inside a flex layout without explicit height bounds. On some mobile browsers, this can cause the content to not be scrollable or clip at the bottom of the viewport.

2. **Table columns hidden on mobile**: Many admin tables use `hidden md:table-cell` and `hidden lg:table-cell` to hide columns on smaller screens. While intentional, this means users on mobile see fewer columns (e.g., Receiver, Fee, Commission, Date-Time, Balance After, Platform %, Admin, Reason are all hidden). This could be what the user perceives as "content hiding."

3. **Support Dashboard fixed height**: `AdminSupportDashboard` uses `h-[calc(100vh-12rem)]` which may miscalculate on mobile with dynamic browser chrome (address bar appearing/disappearing).

4. **Permissions table too wide**: The `AdminPermissions` table has 7+ columns with no responsive hiding, causing horizontal scroll that content may appear cut off.

### Plan

1. **Fix main content area scroll** - Change `<main className="flex-1 p-4 md:p-8 overflow-auto">` to use `min-h-0` to properly enable scrolling in the flex layout, and add `pb-8` for bottom padding on mobile.

2. **Add mobile search bar** - The global search input is `hidden md:block` in the header, meaning mobile users cannot search. Add a mobile-visible search bar.

3. **Fix Support Dashboard height** - Replace `h-[calc(100vh-12rem)]` with a more robust height calculation using `dvh` (dynamic viewport height) with fallback.

4. **Make Permissions table responsive** - Hide the less important columns (sms_read, Last Updated) on mobile.

5. **Improve Commissions table** - The Platform % column is hidden on mobile. Add it back or show it in a different way.

6. **Ensure all dialog/modal content scrollable on mobile** - Verify all admin dialogs have `max-h-[90vh] overflow-y-auto` consistently.

### Files to Modify

- `src/pages/AdminDashboard.tsx` - Fix main area scroll, add mobile search
- `src/components/admin/AdminSupportDashboard.tsx` - Fix height calculation
- `src/components/admin/AdminPermissions.tsx` - Make responsive
- `src/components/admin/AdminCommissionSetup.tsx` - Make Platform % visible on mobile

