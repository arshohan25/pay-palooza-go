

## Plan: Add Support Section to Account Page

### What's Changing
A new **"Support & Help"** section will be added to the Account page (between Notifications and Security sections) with three options:

1. **Live Chat** — Opens the existing `SupportChat` component in a bottom sheet (reusing the same pattern from ProfileEditFlow)
2. **Support Ticket** — Opens a form to submit a support ticket (subject + description) saved to the `support_conversations` table with status "open"
3. **Email Support** — Opens the user's email client with a pre-filled `mailto:` link to `EasyPay@smartshop.bd`

### Technical Details

**File: `src/pages/AccountPage.tsx`**
- Import `SupportChat`, `Sheet`/`SheetContent`/`SheetHeader`/`SheetTitle`, and new icons (`MessageCircle`, `Mail`, `Ticket`)
- Add `showSupport` and `userId` state variables
- Fetch `userId` from the auth session in the existing `useEffect`
- Add a new `<Section title="Support & Help">` block with three `<MenuRow>` entries:
  - **Live Chat**: sets `showSupport = true`, opens a bottom `Sheet` with `<SupportChat userId={userId} />`
  - **Submit a Ticket**: sets `showTicketForm = true`, opens a bottom `Sheet` with a simple form (subject input + description textarea + submit button) that inserts into `support_conversations`
  - **Email Us**: triggers `window.open("mailto:EasyPay@smartshop.bd?subject=Support Request")` directly
- Add the two `Sheet` components at the bottom of the JSX alongside the existing modals

**No database or edge function changes needed** — reuses existing `support_conversations` and `support_messages` tables and the `SupportChat` component.

