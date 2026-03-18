

## Fix: Remove "Soon" Badge from Donations

The screenshot shows the Donations icon in the "More Services" grid still displays a "Soon" badge. This is because in `src/components/QuickActions.tsx` (line 98), the Donations entry has `soon: true`.

### Change

**`src/components/QuickActions.tsx` line 98** — change `soon: true` to `soon: false` for the donations entry.

