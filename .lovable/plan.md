# Polish Merchant Logout Dialog

The dialog already disables both buttons via `disabled={loggingOut}` and Radix already returns focus to the opener on close. This pass tightens the UX with a smoother close transition, an explicit focus-return guarantee, and a clearer locked visual state on "No" while the logout request is in flight.

## Changes (single file: `src/pages/MerchantDashboard.tsx`)

1. **Focus return to trigger**
   - Add a `logoutTriggerRef = useRef<HTMLButtonElement>(null)` and attach it to the existing logout button (the one that calls `setShowLogoutConfirm(true)`).
   - On `<AlertDialogContent>`, add `onCloseAutoFocus={(e) => { e.preventDefault(); logoutTriggerRef.current?.focus(); }}` so focus reliably returns to the trigger after both "No" and "Yes" (when the dialog later closes).

2. **Smooth close transition**
   - On `AlertDialogContent`, extend the existing classes with explicit timing/easing for the close animation:
     `data-[state=closed]:duration-200 data-[state=open]:duration-200 data-[state=closed]:ease-out data-[state=open]:ease-out`
     and add `data-[state=closed]:zoom-out-95 data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95` (overrides on top of defaults to ensure consistent feel on this custom-styled content).

3. **Locked state while processing**
   - Keep `disabled={loggingOut}` on both buttons (already present).
   - Add visual lock styling to both: `disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none`.
   - "No" label swaps to a muted `Please wait` (no spinner) while `loggingOut` is true so the user understands why it's inert.
   - `onOpenChange` already blocks dismissal during `loggingOut` — keep as-is. Also add `onEscapeKeyDown` and `onPointerDownOutside` handlers that call `e.preventDefault()` when `loggingOut` so Esc / outside-click cannot bypass the lock.

## Out of scope
- No changes to `handleLogout`, the watchdog, or routing.
- No restyle of the dialog card, gradient, or button shapes.