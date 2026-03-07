

## Plan: Redesign Send Money Flow — Simplified bKash-inspired UI

### Reference
The screenshot shows a clean, minimal layout: a simple search bar at top, category tabs (Favourites, Auto Pay, Group Send), a "Recent" section with circular avatars + name/phone, then an "All Contacts" section with alphabetical contact list. The design is flat, spacious, and content-focused.

### Changes — `src/components/SendMoneyFlow.tsx`

**Step 1 (Recipient) — Full redesign inspired by reference:**

1. **Header**: Simplify to a clean flat colored bar with back arrow, centered "Send Money" title, and a small QR scan icon on the right (like the reference's paper-plane icon). Remove subtitle text and progress bar from this step.

2. **Search field**: Full-width rounded search input with placeholder "Enter name or number" — no QR button inside the field. Clean, minimal, no type badge below.

3. **Category tabs**: Add a horizontal row of 3 icon-tabs below search:
   - "Favourites (0)" — star icon
   - "Auto Pay" — clock/repeat icon  
   - "Group Send" — users icon
   These are visual-only placeholders for now (non-functional, show empty state on tap).

4. **Recent section**: Label "Recent" with horizontal divider. Show recent contacts as vertical list rows with circular colored avatar (initials), name on first line, phone on second line. Show up to 4 recent contacts. Keep the "Find in Contacts" logic but move it to a subtle link at the bottom.

5. **All Contacts section**: When `phoneContacts` has entries, show them under an "All Contacts" label in the same row format, sorted alphabetically. If contacts with multiple numbers, show a chevron dropdown indicator.

6. **Remove**: The explicit "Continue" button — tapping a contact directly proceeds. For manual number entry, show a small "Send to this number" row that appears when a valid number is detected.

**Steps 2-5 (Amount, Confirm, PIN, Success) — Subtle polish:**

7. **Progress indicator**: Replace the wide gradient progress bar with a simple dot stepper (4 small dots, active = filled, others = outline) centered below the header.

8. **Amount step**: Keep current layout but make quick-amount pills a single horizontal scroll row instead of 3x2 grid. Slightly reduce visual weight of the cash-out toggle.

9. **Confirm step**: No major changes, just ensure consistent rounded cards.

10. **Success step**: Keep as-is (already polished).

### Files Modified
- `src/components/SendMoneyFlow.tsx`

