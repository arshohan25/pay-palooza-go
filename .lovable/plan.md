

# Remove Disappearing Messages Timer from Support Chat

## Change
Remove the disappearing messages dropdown menu (timer icon + popover with Off/30s/5m/1h/24h options) from the support chat header bar.

**File:** `src/components/SupportChat.tsx`
- Delete lines 327-350 (the `{/* Disappearing message timer */}` block containing the `DropdownMenu`)
- Remove the `DISAPPEAR_OPTIONS` constant and `disappearTimer` state if they become unused
- Remove unused imports (`Timer`, `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `Check`) if no longer referenced elsewhere in the file

Single file change.

